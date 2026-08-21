-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Per-day survey response rows (032)
--   survey_day_responses  → ONE ROW PER DAY (mon…sat); every day row
--                           carries BOTH lunch (l_*) and dinner (d_*)
--                           in the same row, exactly like the day card.
--   submit_survey_day     → atomic, audited write that:
--                             • creates the 6 day rows the moment the
--                               survey is started (begin / first save),
--                             • upserts ONLY the targeted day row,
--                             • keeps survey_submissions_flat in sync as a
--                               denormalized mirror (one row per week) so the
--                               existing admin dashboards keep working,
--                             • stamps submitted_at when all 12 slots exist,
--                             • is advisory-locked + idempotent via request_id.
--
-- The member app writes per-day rows; the flat mirror is maintained by the
-- RPC in the SAME transaction, so reads from survey_submissions_flat stay
-- correct for admins, dashboards, the digest, and the member pages.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Per-day response table ──
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'survey_day_responses') THEN
    DROP POLICY IF EXISTS "Users can read own day responses" ON survey_day_responses;
    DROP POLICY IF EXISTS "Admins can read all day responses" ON survey_day_responses;
    DROP POLICY IF EXISTS "Users can insert own day responses" ON survey_day_responses;
    DROP POLICY IF EXISTS "Users can update own day responses" ON survey_day_responses;
    DROP POLICY IF EXISTS "Admins can update any day response" ON survey_day_responses;
    DROP POLICY IF EXISTS "Admins can delete day responses" ON survey_day_responses;
    DROP TRIGGER IF EXISTS update_survey_day_responses_updated_at ON survey_day_responses;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS survey_day_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id DATE NOT NULL,
  day TEXT NOT NULL CHECK (day IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat')),
  thali_number TEXT,
  email TEXT,
  -- Lunch + dinner live in the SAME per-day row.
  l_status TEXT CHECK (l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  l_dish_1 TEXT, l_dish_2 TEXT, l_dish_3 TEXT, l_dish_4 TEXT, l_dish_5 TEXT,
  d_status TEXT CHECK (d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  d_dish_1 TEXT, d_dish_2 TEXT, d_dish_3 TEXT, d_dish_4 TEXT, d_dish_5 TEXT,
  dish_snapshot JSONB,
  edit_metadata JSONB,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_id, day)
);

CREATE INDEX IF NOT EXISTS idx_survey_day_user_week ON survey_day_responses(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_survey_day_week ON survey_day_responses(week_id);

ALTER TABLE survey_day_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own day responses" ON survey_day_responses;
CREATE POLICY "Users can read own day responses"
  ON survey_day_responses FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all day responses" ON survey_day_responses;
CREATE POLICY "Admins can read all day responses"
  ON survey_day_responses FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Users can insert own day responses" ON survey_day_responses;
CREATE POLICY "Users can insert own day responses"
  ON survey_day_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own day responses" ON survey_day_responses;
CREATE POLICY "Users can update own day responses"
  ON survey_day_responses FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update any day response" ON survey_day_responses;
CREATE POLICY "Admins can update any day response"
  ON survey_day_responses FOR UPDATE
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete day responses" ON survey_day_responses;
CREATE POLICY "Admins can delete day responses"
  ON survey_day_responses FOR DELETE
  USING (public.is_admin());

DROP TRIGGER IF EXISTS update_survey_day_responses_updated_at ON survey_day_responses;
CREATE TRIGGER update_survey_day_responses_updated_at
  BEFORE UPDATE ON survey_day_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Realtime: member + admin pages listen to postgres_changes on the new table.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'survey_day_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_day_responses;
  END IF;
END $$;

-- ── 2. Audit log records which day a write targeted ──
ALTER TABLE survey_write_log
  ADD COLUMN IF NOT EXISTS day TEXT;

-- Members may APPEND their own write-log rows. This is what lets the client
-- fallback path (edge function unreachable) record what it wrote, so the admin
-- Write Log page stays complete even in fallback mode. Read access stays
-- admin-only; a member can only ever add rows for their own user_id.
DROP POLICY IF EXISTS "Users can log own writes" ON survey_write_log;
CREATE POLICY "Users can log own writes"
  ON survey_write_log FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Backfill: split every existing flat week into 6 per-day rows so the
-- day table is the canonical store from day one (idempotent — never touches
-- rows already created). ──
DO $$
DECLARE
  r record;
  d text;
  v_key text;
  v_slot_key text;
  v_j jsonb;
  v_payload jsonb;
  v_days text[] := ARRAY['mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
BEGIN
  FOR r IN SELECT * FROM survey_submissions_flat LOOP
    v_payload := to_jsonb(r)
      - ARRAY['id', 'user_id', 'week_id', 'thali_number', 'email',
              'dish_snapshot', 'edit_metadata', 'submitted_at',
              'created_at', 'updated_at']::text[];
    FOREACH d IN ARRAY v_days LOOP
      v_j := jsonb_build_object(
        'user_id', r.user_id, 'week_id', r.week_id, 'day', d,
        'thali_number', r.thali_number, 'email', r.email,
        'dish_snapshot', r.dish_snapshot, 'edit_metadata', r.edit_metadata,
        'submitted_at', r.submitted_at
      );
      FOR v_key IN SELECT jsonb_object_keys(v_payload) LOOP
        IF left(v_key, length(d) + 1) = d || '_' THEN
          v_slot_key := substr(v_key, length(d) + 2);
          v_j := v_j || jsonb_build_object(v_slot_key, v_payload->v_key);
        END IF;
      END LOOP;
      INSERT INTO survey_day_responses
        (user_id, week_id, day, thali_number, email,
         l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5, l_dish_6,
         l_dish_7, l_dish_8, l_dish_9, l_dish_10, l_dish_11, l_dish_12,
         l_dish_13, l_dish_14,
         d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5, d_dish_6,
         d_dish_7, d_dish_8, d_dish_9, d_dish_10, d_dish_11, d_dish_12,
         d_dish_13, d_dish_14,
         dish_snapshot, edit_metadata, submitted_at)
      SELECT r2.user_id, r2.week_id, r2.day, r2.thali_number, r2.email,
             r2.l_status, r2.l_dish_1, r2.l_dish_2, r2.l_dish_3, r2.l_dish_4,
             r2.l_dish_5, r2.l_dish_6, r2.l_dish_7, r2.l_dish_8, r2.l_dish_9,
             r2.l_dish_10, r2.l_dish_11, r2.l_dish_12, r2.l_dish_13, r2.l_dish_14,
             r2.d_status, r2.d_dish_1, r2.d_dish_2, r2.d_dish_3, r2.d_dish_4,
             r2.d_dish_5, r2.d_dish_6, r2.d_dish_7, r2.d_dish_8, r2.d_dish_9,
             r2.d_dish_10, r2.d_dish_11, r2.d_dish_12, r2.d_dish_13, r2.d_dish_14,
             r2.dish_snapshot, r2.edit_metadata, r2.submitted_at
      FROM jsonb_populate_record(NULL::survey_day_responses, v_j) AS r2
      ON CONFLICT (user_id, week_id, day) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- ── 4. submit_survey_day — atomic per-day write + flat mirror ──
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

  -- ── 3. Static day-scoped whitelist ──
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