-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Atomic survey submission (031)
--   submit_survey(p_user_id, p_week_id, p_payload, p_request_id)
--
-- Replaces the edge function's TWO sequential calls (upsert, then a
-- separate survey_write_log insert) with ONE database transaction:
--
--   • pg_advisory_xact_lock serializes concurrent writes for the same
--     (user_id, week_id) row, so a double-submit can never interleave
--     two partial writes and leave a torn row.
--   • The upsert + audit log commit atomically — a crash in the middle
--     can no longer leave a saved response with no log (or vice-versa).
--   • Column writes go through a static whitelist built from the fixed
--     day/meal lists; payload keys are NEVER interpolated into SQL.
--   • p_request_id makes retries idempotent: if the same request already
--     logged a success (e.g. the response was lost in transit), it is a
--     no-op instead of a double write.
--
-- SECURITY DEFINER so it bypasses client RLS; execution is restricted to
-- the service role (the edge function). Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- request_id column on the audit log for idempotent retries.
ALTER TABLE survey_write_log
  ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE INDEX IF NOT EXISTS idx_survey_write_log_request
  ON survey_write_log(request_id);

CREATE OR REPLACE FUNCTION public.submit_survey(
  p_user_id uuid,
  p_week_id date,
  p_payload jsonb,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days text[] := ARRAY['mon','tue','wed','thu','fri','sat'];
  v_meals text[] := ARRAY['l','d'];
  v_whitelist text[];
  v_present text[] := '{}';
  v_k text;
  v_cols text;
  v_set text;
  v_sql text;
  v_slot_count integer := 0;
  v_action text := 'submit';
  v_update jsonb;
  v_now timestamptz := now();
  v_dedup uuid;
BEGIN
  -- ── 1. Serialize concurrent writes to the same (user, week) row ──
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || p_week_id::text, 0));

  -- ── 2. Idempotency: a retried request that already logged SUCCESS is a
  -- no-op. The first write may have committed while its HTTP response was
  -- lost (timeout), so the retry must not duplicate the write or the log.
  IF p_request_id IS NOT NULL AND btrim(p_request_id) <> '' THEN
    SELECT id INTO v_dedup
    FROM survey_write_log
    WHERE request_id = p_request_id AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_dedup IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'deduped', true, 'week_id', p_week_id, 'slots', 0);
    END IF;
  END IF;

  -- ── 3. Build the column whitelist from the fixed day/meal lists ──
  SELECT array_agg(c) INTO v_whitelist FROM (
    SELECT unnest(ARRAY['thali_number','email','dish_snapshot','edit_metadata']) AS c
    UNION ALL
    SELECT d || '_' || m || '_status' FROM unnest(v_days) AS d, unnest(v_meals) AS m
    UNION ALL
    SELECT d || '_' || m || '_dish_' || i::text
      FROM unnest(v_days) AS d, unnest(v_meals) AS m, generate_series(1, 14) AS i
  ) t(c);

  -- Keep only keys the payload actually provides, are whitelisted, and are
  -- non-null non-empty — never clobber existing data with NULL/''.
  FOREACH v_k IN ARRAY v_whitelist LOOP
    IF p_payload ? v_k AND jsonb_typeof(p_payload->v_k) <> 'null' THEN
      IF jsonb_typeof(p_payload->v_k) = 'string' AND p_payload->>v_k = '' THEN
        CONTINUE;
      END IF;
      v_present := v_present || v_k;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_slot_count FROM unnest(v_present) AS k WHERE k LIKE '%_status';

  -- A write covering all 12 slots = full weekly submission: set submitted_at.
  IF v_slot_count = 12 THEN
    v_present := v_present || ARRAY['submitted_at'];
  END IF;

  v_update := jsonb_build_object('user_id', p_user_id, 'week_id', p_week_id, 'updated_at', v_now)
    || (SELECT COALESCE(jsonb_object_agg(k, p_payload->k), '{}'::jsonb) FROM unnest(v_present) AS k);

  IF v_slot_count = 12 THEN
    v_update := v_update || jsonb_build_object('submitted_at', v_now);
  END IF;
  v_action := CASE WHEN v_slot_count = 0 THEN 'draft' ELSE 'submit' END;

  -- ── 4. Atomic upsert (only whitelisted columns) ──
  IF array_length(v_present, 1) > 0 THEN
    SELECT string_agg(format('%I', k), ', ') INTO v_cols FROM unnest(v_present) AS k;
    SELECT 'updated_at = EXCLUDED.updated_at, ' || string_agg(format('%I = EXCLUDED.%I', k, k), ', ')
      INTO v_set
      FROM unnest(v_present) AS k;
    v_sql := format(
      'INSERT INTO survey_submissions_flat (user_id, week_id, updated_at, %s) ' ||
      'SELECT user_id, week_id, updated_at, %s FROM jsonb_populate_record(NULL::survey_submissions_flat, %L::jsonb) AS r ' ||
      'ON CONFLICT (user_id, week_id) DO UPDATE SET %s',
      v_cols, v_cols, v_update::text, v_set
    );
  ELSE
    v_sql := format(
      'INSERT INTO survey_submissions_flat (user_id, week_id, updated_at) ' ||
      'SELECT user_id, week_id, updated_at FROM jsonb_populate_record(NULL::survey_submissions_flat, %L::jsonb) AS r ' ||
      'ON CONFLICT (user_id, week_id) DO UPDATE SET updated_at = EXCLUDED.updated_at',
      v_update::text
    );
  END IF;
  EXECUTE v_sql;

  -- ── 5. Audit log in the SAME transaction as the write ──
  INSERT INTO survey_write_log (user_id, week_id, action, payload, status, request_id)
  VALUES (p_user_id, p_week_id, v_action, p_payload, 'success', p_request_id);

  RETURN jsonb_build_object('ok', true, 'deduped', false, 'week_id', p_week_id, 'slots', v_slot_count);
END;
$$;

-- Only the edge function (service role) may execute this; members cannot
-- bypass the edge function's auth + validation by calling it directly.
REVOKE ALL ON FUNCTION public.submit_survey(uuid, date, jsonb, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_survey(uuid, date, jsonb, text) TO service_role;
