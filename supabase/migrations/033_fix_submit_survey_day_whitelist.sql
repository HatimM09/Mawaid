-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Fix submit_survey_day whitelist query (033)
--   Migration 032 built the dish-column whitelist with
--     SELECT unnest(m || '_dish_' || i::text)
--   which wraps a scalar TEXT in unnest() — Postgres has no
--   unnest(text), so EVERY call crashed with
--     function unnest(text) does not exist
--   (the table, policies and backfill in 032 were fine; only the
--   RPC was broken). This re-creates the same function with the
--   concatenation selected directly, as migration 031 already does.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.submit_survey_day(
  p_user_id uuid,
  p_week_id date,
  p_day text DEFAULT NULL,
  p_payload jsonb DEFAULT '{}'::jsonb,
  p_request_id text DEFAULT NULL,
  p_begin boolean DEFAULT false
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days text[] := ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  v_whitelist text[];
  v_present text[] := '{}';
  v_flat_present text[] := '{}';
  v_k text;
  v_flat_key text;
  v_cols text;
  v_set text;
  v_sql text;
  v_flat_cols text;
  v_flat_set text;
  v_update jsonb;
  v_flat_update jsonb;
  v_slot_count integer := 0;
  v_payload_size integer := 0;
  v_action text := 'submit';
  v_now timestamptz := now();
  v_dedup uuid;
BEGIN
  -- ── 1. Serialize concurrent writes to the same (user, week) ──
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || p_week_id::text, 0));

  -- ── 2. Idempotent retry: a request that already logged SUCCESS is a no-op ──
  IF p_request_id IS NOT NULL AND btrim(p_request_id) <> '' THEN
    SELECT id INTO v_dedup
    FROM survey_write_log
    WHERE request_id = p_request_id AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_dedup IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'deduped', true, 'week_id', p_week_id,
                                'day', p_day, 'seeded', true, 'slots', 0);
    END IF;
  END IF;

  -- ── 3. Static day-scoped whitelist (FIXED: no unnest() around scalar text) ──
  SELECT array_agg(c) INTO v_whitelist FROM (
    SELECT unnest(ARRAY['l_status', 'd_status', 'dish_snapshot', 'edit_metadata',
                        'thali_number', 'email', 'submitted_at']) AS c
    UNION ALL
    SELECT m || '_dish_' || i::text
      FROM unnest(ARRAY['l', 'd']) AS m, generate_series(1, 14) AS i
  ) t(c);

  -- ── 4. Auto-create the six per-day rows when the survey starts ──
  IF p_payload IS NOT NULL AND jsonb_typeof(p_payload) = 'object' THEN
    v_payload_size := (SELECT count(*) FROM jsonb_object_keys(p_payload));
  END IF;
  IF p_begin OR v_payload_size > 0 THEN
    INSERT INTO survey_day_responses (user_id, week_id, day)
    SELECT p_user_id, p_week_id, unnest(v_days)
    ON CONFLICT (user_id, week_id, day) DO NOTHING;
  END IF;
  v_action := CASE WHEN p_begin AND v_payload_size = 0 THEN 'begin' ELSE 'submit' END;

  -- ── 5. Whitelist the present payload keys (day-scoped keys need a day) ──
  IF p_payload IS NOT NULL AND v_payload_size > 0 THEN
    FOREACH v_k IN ARRAY v_whitelist LOOP
      IF p_payload ? v_k AND jsonb_typeof(p_payload->v_k) <> 'null' THEN
        IF jsonb_typeof(p_payload->v_k) = 'string' AND p_payload->>v_k = '' THEN
          CONTINUE;
        END IF;
        IF (v_k LIKE 'l\_%' OR v_k LIKE 'd\_%') AND p_day IS NULL THEN
          CONTINUE;
        END IF;
        v_present := v_present || v_k;
      END IF;
    END LOOP;
  END IF;

  -- ── 6. Upsert ONLY the targeted day row (whitelisted columns) ──
  IF p_day IS NOT NULL AND array_length(v_present, 1) > 0 THEN
    SELECT count(*) INTO v_slot_count
    FROM unnest(v_present) AS k WHERE k IN ('l_status', 'd_status');

    v_update := jsonb_build_object('user_id', p_user_id, 'week_id', p_week_id,
                                   'day', p_day, 'updated_at', v_now)
      || (SELECT COALESCE(jsonb_object_agg(k, p_payload->k), '{}'::jsonb)
          FROM unnest(v_present) AS k);

    SELECT string_agg(format('%I', k), ', ') INTO v_cols FROM unnest(v_present) AS k;
    SELECT 'updated_at = EXCLUDED.updated_at, '
           || string_agg(format('%I = EXCLUDED.%I', k, k), ', ')
      INTO v_set FROM unnest(v_present) AS k;
    v_sql := format(
      'INSERT INTO survey_day_responses (user_id, week_id, day, updated_at, %s) ' ||
      'SELECT user_id, week_id, day, updated_at, %s ' ||
      'FROM jsonb_populate_record(NULL::survey_day_responses, %L::jsonb) AS r ' ||
      'ON CONFLICT (user_id, week_id, day) DO UPDATE SET %s',
      v_cols, v_cols, v_update::text, v_set
    );
    EXECUTE v_sql;
  END IF;

  -- ── 7. Flat mirror: keep the one-row-per-week table in sync so admin
  -- dashboards, the digest and the member pages keep reading it. ──
  IF array_length(v_present, 1) > 0 THEN
    v_flat_update := jsonb_build_object('user_id', p_user_id, 'week_id', p_week_id,
                                        'updated_at', v_now);
    FOREACH v_k IN ARRAY v_present LOOP
      IF v_k LIKE 'l\_%' OR v_k LIKE 'd\_%' THEN
        v_flat_key := p_day || '_' || v_k;
      ELSE
        v_flat_key := v_k;
      END IF;
      v_flat_present := v_flat_present || v_flat_key;
      v_flat_update := v_flat_update || jsonb_build_object(v_flat_key, p_payload->v_k);
    END LOOP;

    SELECT string_agg(format('%I', k), ', ') INTO v_flat_cols
    FROM unnest(v_flat_present) AS k;
    SELECT 'updated_at = EXCLUDED.updated_at, '
           || string_agg(format('%I = EXCLUDED.%I', k, k), ', ')
      INTO v_flat_set FROM unnest(v_flat_present) AS k;
    v_sql := format(
      'INSERT INTO survey_submissions_flat (user_id, week_id, updated_at, %s) ' ||
      'SELECT user_id, week_id, updated_at, %s ' ||
      'FROM jsonb_populate_record(NULL::survey_submissions_flat, %L::jsonb) AS r ' ||
      'ON CONFLICT (user_id, week_id) DO UPDATE SET %s',
      v_flat_cols, v_flat_cols, v_flat_update::text, v_flat_set
    );
    EXECUTE v_sql;
  END IF;

  -- ── 8. Full weekly submission: all 12 slots answered → stamp submitted_at ──
  IF (SELECT count(*) FROM survey_submissions_flat f
      WHERE f.user_id = p_user_id AND f.week_id = p_week_id
        AND f.mon_l_status IS NOT NULL AND f.mon_d_status IS NOT NULL
        AND f.tue_l_status IS NOT NULL AND f.tue_d_status IS NOT NULL
        AND f.wed_l_status IS NOT NULL AND f.wed_d_status IS NOT NULL
        AND f.thu_l_status IS NOT NULL AND f.thu_d_status IS NOT NULL
        AND f.fri_l_status IS NOT NULL AND f.fri_d_status IS NOT NULL
        AND f.sat_l_status IS NOT NULL AND f.sat_d_status IS NOT NULL) = 1 THEN
    UPDATE survey_submissions_flat
      SET submitted_at = v_now, updated_at = v_now
      WHERE user_id = p_user_id AND week_id = p_week_id AND submitted_at IS NULL;
    UPDATE survey_day_responses
      SET submitted_at = v_now
      WHERE user_id = p_user_id AND week_id = p_week_id AND submitted_at IS NULL;
  END IF;

  -- ── 9. Audit log in the SAME transaction ──
  INSERT INTO survey_write_log (user_id, week_id, day, action, payload, status, request_id)
  VALUES (p_user_id, p_week_id, p_day, v_action, p_payload, 'success', p_request_id);

  RETURN jsonb_build_object('ok', true, 'deduped', false, 'week_id', p_week_id,
                            'day', p_day, 'seeded', true, 'slots', v_slot_count);
END;
$$;

-- Only the edge function (service role) may execute it; members cannot bypass
-- the edge function's auth + validation by calling it directly.
REVOKE ALL ON FUNCTION public.submit_survey_day(uuid, date, text, jsonb, text, boolean)
  FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_survey_day(uuid, date, text, jsonb, text, boolean)
  TO service_role;