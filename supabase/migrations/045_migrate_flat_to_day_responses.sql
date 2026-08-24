-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Migrate Flat Responses to Day Responses (045)
-- Migrates all survey data from survey_submissions_flat into
-- survey_day_responses without data loss, mismatch, or errors.
-- Idempotent — safe to re-run multiple times.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.migrate_all_flat_responses_to_day_responses()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count INT := 0;
  v_flat_count INT := 0;
BEGIN
  -- Check if survey_submissions_flat table exists
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'survey_submissions_flat') THEN
    RETURN jsonb_build_object('status', 'skipped', 'message', 'survey_submissions_flat table does not exist');
  END IF;

  SELECT COUNT(*) INTO v_flat_count FROM survey_submissions_flat;

  -- ── MONDAY ──
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  )
  SELECT
    user_id, week_id, 'mon', thali_number, email,
    mon_l_status, mon_l_dish_1, mon_l_dish_2, mon_l_dish_3, mon_l_dish_4, mon_l_dish_5,
    mon_d_status, mon_d_dish_1, mon_d_dish_2, mon_d_dish_3, mon_d_dish_4, mon_d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  FROM survey_submissions_flat
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(survey_day_responses.thali_number, EXCLUDED.thali_number),
    email         = COALESCE(survey_day_responses.email, EXCLUDED.email),
    l_status      = COALESCE(survey_day_responses.l_status, EXCLUDED.l_status),
    l_dish_1      = COALESCE(survey_day_responses.l_dish_1, EXCLUDED.l_dish_1),
    l_dish_2      = COALESCE(survey_day_responses.l_dish_2, EXCLUDED.l_dish_2),
    l_dish_3      = COALESCE(survey_day_responses.l_dish_3, EXCLUDED.l_dish_3),
    l_dish_4      = COALESCE(survey_day_responses.l_dish_4, EXCLUDED.l_dish_4),
    l_dish_5      = COALESCE(survey_day_responses.l_dish_5, EXCLUDED.l_dish_5),
    d_status      = COALESCE(survey_day_responses.d_status, EXCLUDED.d_status),
    d_dish_1      = COALESCE(survey_day_responses.d_dish_1, EXCLUDED.d_dish_1),
    d_dish_2      = COALESCE(survey_day_responses.d_dish_2, EXCLUDED.d_dish_2),
    d_dish_3      = COALESCE(survey_day_responses.d_dish_3, EXCLUDED.d_dish_3),
    d_dish_4      = COALESCE(survey_day_responses.d_dish_4, EXCLUDED.d_dish_4),
    d_dish_5      = COALESCE(survey_day_responses.d_dish_5, EXCLUDED.d_dish_5),
    dish_snapshot = COALESCE(survey_day_responses.dish_snapshot, EXCLUDED.dish_snapshot),
    edit_metadata = COALESCE(survey_day_responses.edit_metadata, EXCLUDED.edit_metadata),
    submitted_at  = COALESCE(survey_day_responses.submitted_at, EXCLUDED.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- ── TUESDAY ──
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  )
  SELECT
    user_id, week_id, 'tue', thali_number, email,
    tue_l_status, tue_l_dish_1, tue_l_dish_2, tue_l_dish_3, tue_l_dish_4, tue_l_dish_5,
    tue_d_status, tue_d_dish_1, tue_d_dish_2, tue_d_dish_3, tue_d_dish_4, tue_d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  FROM survey_submissions_flat
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(survey_day_responses.thali_number, EXCLUDED.thali_number),
    email         = COALESCE(survey_day_responses.email, EXCLUDED.email),
    l_status      = COALESCE(survey_day_responses.l_status, EXCLUDED.l_status),
    l_dish_1      = COALESCE(survey_day_responses.l_dish_1, EXCLUDED.l_dish_1),
    l_dish_2      = COALESCE(survey_day_responses.l_dish_2, EXCLUDED.l_dish_2),
    l_dish_3      = COALESCE(survey_day_responses.l_dish_3, EXCLUDED.l_dish_3),
    l_dish_4      = COALESCE(survey_day_responses.l_dish_4, EXCLUDED.l_dish_4),
    l_dish_5      = COALESCE(survey_day_responses.l_dish_5, EXCLUDED.l_dish_5),
    d_status      = COALESCE(survey_day_responses.d_status, EXCLUDED.d_status),
    d_dish_1      = COALESCE(survey_day_responses.d_dish_1, EXCLUDED.d_dish_1),
    d_dish_2      = COALESCE(survey_day_responses.d_dish_2, EXCLUDED.d_dish_2),
    d_dish_3      = COALESCE(survey_day_responses.d_dish_3, EXCLUDED.d_dish_3),
    d_dish_4      = COALESCE(survey_day_responses.d_dish_4, EXCLUDED.d_dish_4),
    d_dish_5      = COALESCE(survey_day_responses.d_dish_5, EXCLUDED.d_dish_5),
    dish_snapshot = COALESCE(survey_day_responses.dish_snapshot, EXCLUDED.dish_snapshot),
    edit_metadata = COALESCE(survey_day_responses.edit_metadata, EXCLUDED.edit_metadata),
    submitted_at  = COALESCE(survey_day_responses.submitted_at, EXCLUDED.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- ── WEDNESDAY ──
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  )
  SELECT
    user_id, week_id, 'wed', thali_number, email,
    wed_l_status, wed_l_dish_1, wed_l_dish_2, wed_l_dish_3, wed_l_dish_4, wed_l_dish_5,
    wed_d_status, wed_d_dish_1, wed_d_dish_2, wed_d_dish_3, wed_d_dish_4, wed_d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  FROM survey_submissions_flat
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(survey_day_responses.thali_number, EXCLUDED.thali_number),
    email         = COALESCE(survey_day_responses.email, EXCLUDED.email),
    l_status      = COALESCE(survey_day_responses.l_status, EXCLUDED.l_status),
    l_dish_1      = COALESCE(survey_day_responses.l_dish_1, EXCLUDED.l_dish_1),
    l_dish_2      = COALESCE(survey_day_responses.l_dish_2, EXCLUDED.l_dish_2),
    l_dish_3      = COALESCE(survey_day_responses.l_dish_3, EXCLUDED.l_dish_3),
    l_dish_4      = COALESCE(survey_day_responses.l_dish_4, EXCLUDED.l_dish_4),
    l_dish_5      = COALESCE(survey_day_responses.l_dish_5, EXCLUDED.l_dish_5),
    d_status      = COALESCE(survey_day_responses.d_status, EXCLUDED.d_status),
    d_dish_1      = COALESCE(survey_day_responses.d_dish_1, EXCLUDED.d_dish_1),
    d_dish_2      = COALESCE(survey_day_responses.d_dish_2, EXCLUDED.d_dish_2),
    d_dish_3      = COALESCE(survey_day_responses.d_dish_3, EXCLUDED.d_dish_3),
    d_dish_4      = COALESCE(survey_day_responses.d_dish_4, EXCLUDED.d_dish_4),
    d_dish_5      = COALESCE(survey_day_responses.d_dish_5, EXCLUDED.d_dish_5),
    dish_snapshot = COALESCE(survey_day_responses.dish_snapshot, EXCLUDED.dish_snapshot),
    edit_metadata = COALESCE(survey_day_responses.edit_metadata, EXCLUDED.edit_metadata),
    submitted_at  = COALESCE(survey_day_responses.submitted_at, EXCLUDED.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- ── THURSDAY ──
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  )
  SELECT
    user_id, week_id, 'thu', thali_number, email,
    thu_l_status, thu_l_dish_1, thu_l_dish_2, thu_l_dish_3, thu_l_dish_4, thu_l_dish_5,
    thu_d_status, thu_d_dish_1, thu_d_dish_2, thu_d_dish_3, thu_d_dish_4, thu_d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  FROM survey_submissions_flat
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(survey_day_responses.thali_number, EXCLUDED.thali_number),
    email         = COALESCE(survey_day_responses.email, EXCLUDED.email),
    l_status      = COALESCE(survey_day_responses.l_status, EXCLUDED.l_status),
    l_dish_1      = COALESCE(survey_day_responses.l_dish_1, EXCLUDED.l_dish_1),
    l_dish_2      = COALESCE(survey_day_responses.l_dish_2, EXCLUDED.l_dish_2),
    l_dish_3      = COALESCE(survey_day_responses.l_dish_3, EXCLUDED.l_dish_3),
    l_dish_4      = COALESCE(survey_day_responses.l_dish_4, EXCLUDED.l_dish_4),
    l_dish_5      = COALESCE(survey_day_responses.l_dish_5, EXCLUDED.l_dish_5),
    d_status      = COALESCE(survey_day_responses.d_status, EXCLUDED.d_status),
    d_dish_1      = COALESCE(survey_day_responses.d_dish_1, EXCLUDED.d_dish_1),
    d_dish_2      = COALESCE(survey_day_responses.d_dish_2, EXCLUDED.d_dish_2),
    d_dish_3      = COALESCE(survey_day_responses.d_dish_3, EXCLUDED.d_dish_3),
    d_dish_4      = COALESCE(survey_day_responses.d_dish_4, EXCLUDED.d_dish_4),
    d_dish_5      = COALESCE(survey_day_responses.d_dish_5, EXCLUDED.d_dish_5),
    dish_snapshot = COALESCE(survey_day_responses.dish_snapshot, EXCLUDED.dish_snapshot),
    edit_metadata = COALESCE(survey_day_responses.edit_metadata, EXCLUDED.edit_metadata),
    submitted_at  = COALESCE(survey_day_responses.submitted_at, EXCLUDED.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- ── FRIDAY ──
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  )
  SELECT
    user_id, week_id, 'fri', thali_number, email,
    fri_l_status, fri_l_dish_1, fri_l_dish_2, fri_l_dish_3, fri_l_dish_4, fri_l_dish_5,
    fri_d_status, fri_d_dish_1, fri_d_dish_2, fri_d_dish_3, fri_d_dish_4, fri_d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  FROM survey_submissions_flat
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(survey_day_responses.thali_number, EXCLUDED.thali_number),
    email         = COALESCE(survey_day_responses.email, EXCLUDED.email),
    l_status      = COALESCE(survey_day_responses.l_status, EXCLUDED.l_status),
    l_dish_1      = COALESCE(survey_day_responses.l_dish_1, EXCLUDED.l_dish_1),
    l_dish_2      = COALESCE(survey_day_responses.l_dish_2, EXCLUDED.l_dish_2),
    l_dish_3      = COALESCE(survey_day_responses.l_dish_3, EXCLUDED.l_dish_3),
    l_dish_4      = COALESCE(survey_day_responses.l_dish_4, EXCLUDED.l_dish_4),
    l_dish_5      = COALESCE(survey_day_responses.l_dish_5, EXCLUDED.l_dish_5),
    d_status      = COALESCE(survey_day_responses.d_status, EXCLUDED.d_status),
    d_dish_1      = COALESCE(survey_day_responses.d_dish_1, EXCLUDED.d_dish_1),
    d_dish_2      = COALESCE(survey_day_responses.d_dish_2, EXCLUDED.d_dish_2),
    d_dish_3      = COALESCE(survey_day_responses.d_dish_3, EXCLUDED.d_dish_3),
    d_dish_4      = COALESCE(survey_day_responses.d_dish_4, EXCLUDED.d_dish_4),
    d_dish_5      = COALESCE(survey_day_responses.d_dish_5, EXCLUDED.d_dish_5),
    dish_snapshot = COALESCE(survey_day_responses.dish_snapshot, EXCLUDED.dish_snapshot),
    edit_metadata = COALESCE(survey_day_responses.edit_metadata, EXCLUDED.edit_metadata),
    submitted_at  = COALESCE(survey_day_responses.submitted_at, EXCLUDED.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- ── SATURDAY ──
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  )
  SELECT
    user_id, week_id, 'sat', thali_number, email,
    sat_l_status, sat_l_dish_1, sat_l_dish_2, sat_l_dish_3, sat_l_dish_4, sat_l_dish_5,
    sat_d_status, sat_d_dish_1, sat_d_dish_2, sat_d_dish_3, sat_d_dish_4, sat_d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  FROM survey_submissions_flat
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(survey_day_responses.thali_number, EXCLUDED.thali_number),
    email         = COALESCE(survey_day_responses.email, EXCLUDED.email),
    l_status      = COALESCE(survey_day_responses.l_status, EXCLUDED.l_status),
    l_dish_1      = COALESCE(survey_day_responses.l_dish_1, EXCLUDED.l_dish_1),
    l_dish_2      = COALESCE(survey_day_responses.l_dish_2, EXCLUDED.l_dish_2),
    l_dish_3      = COALESCE(survey_day_responses.l_dish_3, EXCLUDED.l_dish_3),
    l_dish_4      = COALESCE(survey_day_responses.l_dish_4, EXCLUDED.l_dish_4),
    l_dish_5      = COALESCE(survey_day_responses.l_dish_5, EXCLUDED.l_dish_5),
    d_status      = COALESCE(survey_day_responses.d_status, EXCLUDED.d_status),
    d_dish_1      = COALESCE(survey_day_responses.d_dish_1, EXCLUDED.d_dish_1),
    d_dish_2      = COALESCE(survey_day_responses.d_dish_2, EXCLUDED.d_dish_2),
    d_dish_3      = COALESCE(survey_day_responses.d_dish_3, EXCLUDED.d_dish_3),
    d_dish_4      = COALESCE(survey_day_responses.d_dish_4, EXCLUDED.d_dish_4),
    d_dish_5      = COALESCE(survey_day_responses.d_dish_5, EXCLUDED.d_dish_5),
    dish_snapshot = COALESCE(survey_day_responses.dish_snapshot, EXCLUDED.dish_snapshot),
    edit_metadata = COALESCE(survey_day_responses.edit_metadata, EXCLUDED.edit_metadata),
    submitted_at  = COALESCE(survey_day_responses.submitted_at, EXCLUDED.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  SELECT COUNT(*) INTO v_inserted_count FROM survey_day_responses;

  RETURN jsonb_build_object(
    'status', 'success',
    'source_flat_rows', v_flat_count,
    'total_day_response_rows', v_inserted_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.migrate_all_flat_responses_to_day_responses() TO authenticated, service_role;

-- Run migration immediately
SELECT public.migrate_all_flat_responses_to_day_responses();

-- ── Real-time trigger: Auto-sync any future writes from old app versions ──
CREATE OR REPLACE FUNCTION public.sync_flat_to_day_responses_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Mon
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.week_id, 'mon', NEW.thali_number, NEW.email,
    NEW.mon_l_status, NEW.mon_l_dish_1, NEW.mon_l_dish_2, NEW.mon_l_dish_3, NEW.mon_l_dish_4, NEW.mon_l_dish_5,
    NEW.mon_d_status, NEW.mon_d_dish_1, NEW.mon_d_dish_2, NEW.mon_d_dish_3, NEW.mon_d_dish_4, NEW.mon_d_dish_5,
    NEW.dish_snapshot, NEW.edit_metadata, NEW.submitted_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(EXCLUDED.thali_number, survey_day_responses.thali_number),
    email         = COALESCE(EXCLUDED.email, survey_day_responses.email),
    l_status      = COALESCE(EXCLUDED.l_status, survey_day_responses.l_status),
    l_dish_1      = COALESCE(EXCLUDED.l_dish_1, survey_day_responses.l_dish_1),
    l_dish_2      = COALESCE(EXCLUDED.l_dish_2, survey_day_responses.l_dish_2),
    l_dish_3      = COALESCE(EXCLUDED.l_dish_3, survey_day_responses.l_dish_3),
    l_dish_4      = COALESCE(EXCLUDED.l_dish_4, survey_day_responses.l_dish_4),
    l_dish_5      = COALESCE(EXCLUDED.l_dish_5, survey_day_responses.l_dish_5),
    d_status      = COALESCE(EXCLUDED.d_status, survey_day_responses.d_status),
    d_dish_1      = COALESCE(EXCLUDED.d_dish_1, survey_day_responses.d_dish_1),
    d_dish_2      = COALESCE(EXCLUDED.d_dish_2, survey_day_responses.d_dish_2),
    d_dish_3      = COALESCE(EXCLUDED.d_dish_3, survey_day_responses.d_dish_3),
    d_dish_4      = COALESCE(EXCLUDED.d_dish_4, survey_day_responses.d_dish_4),
    d_dish_5      = COALESCE(EXCLUDED.d_dish_5, survey_day_responses.d_dish_5),
    dish_snapshot = COALESCE(EXCLUDED.dish_snapshot, survey_day_responses.dish_snapshot),
    edit_metadata = COALESCE(EXCLUDED.edit_metadata, survey_day_responses.edit_metadata),
    submitted_at  = COALESCE(EXCLUDED.submitted_at, survey_day_responses.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- Tue
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.week_id, 'tue', NEW.thali_number, NEW.email,
    NEW.tue_l_status, NEW.tue_l_dish_1, NEW.tue_l_dish_2, NEW.tue_l_dish_3, NEW.tue_l_dish_4, NEW.tue_l_dish_5,
    NEW.tue_d_status, NEW.tue_d_dish_1, NEW.tue_d_dish_2, NEW.tue_d_dish_3, NEW.tue_d_dish_4, NEW.tue_d_dish_5,
    NEW.dish_snapshot, NEW.edit_metadata, NEW.submitted_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(EXCLUDED.thali_number, survey_day_responses.thali_number),
    email         = COALESCE(EXCLUDED.email, survey_day_responses.email),
    l_status      = COALESCE(EXCLUDED.l_status, survey_day_responses.l_status),
    l_dish_1      = COALESCE(EXCLUDED.l_dish_1, survey_day_responses.l_dish_1),
    l_dish_2      = COALESCE(EXCLUDED.l_dish_2, survey_day_responses.l_dish_2),
    l_dish_3      = COALESCE(EXCLUDED.l_dish_3, survey_day_responses.l_dish_3),
    l_dish_4      = COALESCE(EXCLUDED.l_dish_4, survey_day_responses.l_dish_4),
    l_dish_5      = COALESCE(EXCLUDED.l_dish_5, survey_day_responses.l_dish_5),
    d_status      = COALESCE(EXCLUDED.d_status, survey_day_responses.d_status),
    d_dish_1      = COALESCE(EXCLUDED.d_dish_1, survey_day_responses.d_dish_1),
    d_dish_2      = COALESCE(EXCLUDED.d_dish_2, survey_day_responses.d_dish_2),
    d_dish_3      = COALESCE(EXCLUDED.d_dish_3, survey_day_responses.d_dish_3),
    d_dish_4      = COALESCE(EXCLUDED.d_dish_4, survey_day_responses.d_dish_4),
    d_dish_5      = COALESCE(EXCLUDED.d_dish_5, survey_day_responses.d_dish_5),
    dish_snapshot = COALESCE(EXCLUDED.dish_snapshot, survey_day_responses.dish_snapshot),
    edit_metadata = COALESCE(EXCLUDED.edit_metadata, survey_day_responses.edit_metadata),
    submitted_at  = COALESCE(EXCLUDED.submitted_at, survey_day_responses.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- Wed
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.week_id, 'wed', NEW.thali_number, NEW.email,
    NEW.wed_l_status, NEW.wed_l_dish_1, NEW.wed_l_dish_2, NEW.wed_l_dish_3, NEW.wed_l_dish_4, NEW.wed_l_dish_5,
    NEW.wed_d_status, NEW.wed_d_dish_1, NEW.wed_d_dish_2, NEW.wed_d_dish_3, NEW.wed_d_dish_4, NEW.wed_d_dish_5,
    NEW.dish_snapshot, NEW.edit_metadata, NEW.submitted_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(EXCLUDED.thali_number, survey_day_responses.thali_number),
    email         = COALESCE(EXCLUDED.email, survey_day_responses.email),
    l_status      = COALESCE(EXCLUDED.l_status, survey_day_responses.l_status),
    l_dish_1      = COALESCE(EXCLUDED.l_dish_1, survey_day_responses.l_dish_1),
    l_dish_2      = COALESCE(EXCLUDED.l_dish_2, survey_day_responses.l_dish_2),
    l_dish_3      = COALESCE(EXCLUDED.l_dish_3, survey_day_responses.l_dish_3),
    l_dish_4      = COALESCE(EXCLUDED.l_dish_4, survey_day_responses.l_dish_4),
    l_dish_5      = COALESCE(EXCLUDED.l_dish_5, survey_day_responses.l_dish_5),
    d_status      = COALESCE(EXCLUDED.d_status, survey_day_responses.d_status),
    d_dish_1      = COALESCE(EXCLUDED.d_dish_1, survey_day_responses.d_dish_1),
    d_dish_2      = COALESCE(EXCLUDED.d_dish_2, survey_day_responses.d_dish_2),
    d_dish_3      = COALESCE(EXCLUDED.d_dish_3, survey_day_responses.d_dish_3),
    d_dish_4      = COALESCE(EXCLUDED.d_dish_4, survey_day_responses.d_dish_4),
    d_dish_5      = COALESCE(EXCLUDED.d_dish_5, survey_day_responses.d_dish_5),
    dish_snapshot = COALESCE(EXCLUDED.dish_snapshot, survey_day_responses.dish_snapshot),
    edit_metadata = COALESCE(EXCLUDED.edit_metadata, survey_day_responses.edit_metadata),
    submitted_at  = COALESCE(EXCLUDED.submitted_at, survey_day_responses.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- Thu
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.week_id, 'thu', NEW.thali_number, NEW.email,
    NEW.thu_l_status, NEW.thu_l_dish_1, NEW.thu_l_dish_2, NEW.thu_l_dish_3, NEW.thu_l_dish_4, NEW.thu_l_dish_5,
    NEW.thu_d_status, NEW.thu_d_dish_1, NEW.thu_d_dish_2, NEW.thu_d_dish_3, NEW.thu_d_dish_4, NEW.thu_d_dish_5,
    NEW.dish_snapshot, NEW.edit_metadata, NEW.submitted_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(EXCLUDED.thali_number, survey_day_responses.thali_number),
    email         = COALESCE(EXCLUDED.email, survey_day_responses.email),
    l_status      = COALESCE(EXCLUDED.l_status, survey_day_responses.l_status),
    l_dish_1      = COALESCE(EXCLUDED.l_dish_1, survey_day_responses.l_dish_1),
    l_dish_2      = COALESCE(EXCLUDED.l_dish_2, survey_day_responses.l_dish_2),
    l_dish_3      = COALESCE(EXCLUDED.l_dish_3, survey_day_responses.l_dish_3),
    l_dish_4      = COALESCE(EXCLUDED.l_dish_4, survey_day_responses.l_dish_4),
    l_dish_5      = COALESCE(EXCLUDED.l_dish_5, survey_day_responses.l_dish_5),
    d_status      = COALESCE(EXCLUDED.d_status, survey_day_responses.d_status),
    d_dish_1      = COALESCE(EXCLUDED.d_dish_1, survey_day_responses.d_dish_1),
    d_dish_2      = COALESCE(EXCLUDED.d_dish_2, survey_day_responses.d_dish_2),
    d_dish_3      = COALESCE(EXCLUDED.d_dish_3, survey_day_responses.d_dish_3),
    d_dish_4      = COALESCE(EXCLUDED.d_dish_4, survey_day_responses.d_dish_4),
    d_dish_5      = COALESCE(EXCLUDED.d_dish_5, survey_day_responses.d_dish_5),
    dish_snapshot = COALESCE(EXCLUDED.dish_snapshot, survey_day_responses.dish_snapshot),
    edit_metadata = COALESCE(EXCLUDED.edit_metadata, survey_day_responses.edit_metadata),
    submitted_at  = COALESCE(EXCLUDED.submitted_at, survey_day_responses.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- Fri
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.week_id, 'fri', NEW.thali_number, NEW.email,
    NEW.fri_l_status, NEW.fri_l_dish_1, NEW.fri_l_dish_2, NEW.fri_l_dish_3, NEW.fri_l_dish_4, NEW.fri_l_dish_5,
    NEW.fri_d_status, NEW.fri_d_dish_1, NEW.fri_d_dish_2, NEW.fri_d_dish_3, NEW.fri_d_dish_4, NEW.fri_d_dish_5,
    NEW.dish_snapshot, NEW.edit_metadata, NEW.submitted_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(EXCLUDED.thali_number, survey_day_responses.thali_number),
    email         = COALESCE(EXCLUDED.email, survey_day_responses.email),
    l_status      = COALESCE(EXCLUDED.l_status, survey_day_responses.l_status),
    l_dish_1      = COALESCE(EXCLUDED.l_dish_1, survey_day_responses.l_dish_1),
    l_dish_2      = COALESCE(EXCLUDED.l_dish_2, survey_day_responses.l_dish_2),
    l_dish_3      = COALESCE(EXCLUDED.l_dish_3, survey_day_responses.l_dish_3),
    l_dish_4      = COALESCE(EXCLUDED.l_dish_4, survey_day_responses.l_dish_4),
    l_dish_5      = COALESCE(EXCLUDED.l_dish_5, survey_day_responses.l_dish_5),
    d_status      = COALESCE(EXCLUDED.d_status, survey_day_responses.d_status),
    d_dish_1      = COALESCE(EXCLUDED.d_dish_1, survey_day_responses.d_dish_1),
    d_dish_2      = COALESCE(EXCLUDED.d_dish_2, survey_day_responses.d_dish_2),
    d_dish_3      = COALESCE(EXCLUDED.d_dish_3, survey_day_responses.d_dish_3),
    d_dish_4      = COALESCE(EXCLUDED.d_dish_4, survey_day_responses.d_dish_4),
    d_dish_5      = COALESCE(EXCLUDED.d_dish_5, survey_day_responses.d_dish_5),
    dish_snapshot = COALESCE(EXCLUDED.dish_snapshot, survey_day_responses.dish_snapshot),
    edit_metadata = COALESCE(EXCLUDED.edit_metadata, survey_day_responses.edit_metadata),
    submitted_at  = COALESCE(EXCLUDED.submitted_at, survey_day_responses.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  -- Sat
  INSERT INTO survey_day_responses (
    user_id, week_id, day, thali_number, email,
    l_status, l_dish_1, l_dish_2, l_dish_3, l_dish_4, l_dish_5,
    d_status, d_dish_1, d_dish_2, d_dish_3, d_dish_4, d_dish_5,
    dish_snapshot, edit_metadata, submitted_at, created_at, updated_at
  ) VALUES (
    NEW.user_id, NEW.week_id, 'sat', NEW.thali_number, NEW.email,
    NEW.sat_l_status, NEW.sat_l_dish_1, NEW.sat_l_dish_2, NEW.sat_l_dish_3, NEW.sat_l_dish_4, NEW.sat_l_dish_5,
    NEW.sat_d_status, NEW.sat_d_dish_1, NEW.sat_d_dish_2, NEW.sat_d_dish_3, NEW.sat_d_dish_4, NEW.sat_d_dish_5,
    NEW.dish_snapshot, NEW.edit_metadata, NEW.submitted_at, NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (user_id, week_id, day) DO UPDATE SET
    thali_number  = COALESCE(EXCLUDED.thali_number, survey_day_responses.thali_number),
    email         = COALESCE(EXCLUDED.email, survey_day_responses.email),
    l_status      = COALESCE(EXCLUDED.l_status, survey_day_responses.l_status),
    l_dish_1      = COALESCE(EXCLUDED.l_dish_1, survey_day_responses.l_dish_1),
    l_dish_2      = COALESCE(EXCLUDED.l_dish_2, survey_day_responses.l_dish_2),
    l_dish_3      = COALESCE(EXCLUDED.l_dish_3, survey_day_responses.l_dish_3),
    l_dish_4      = COALESCE(EXCLUDED.l_dish_4, survey_day_responses.l_dish_4),
    l_dish_5      = COALESCE(EXCLUDED.l_dish_5, survey_day_responses.l_dish_5),
    d_status      = COALESCE(EXCLUDED.d_status, survey_day_responses.d_status),
    d_dish_1      = COALESCE(EXCLUDED.d_dish_1, survey_day_responses.d_dish_1),
    d_dish_2      = COALESCE(EXCLUDED.d_dish_2, survey_day_responses.d_dish_2),
    d_dish_3      = COALESCE(EXCLUDED.d_dish_3, survey_day_responses.d_dish_3),
    d_dish_4      = COALESCE(EXCLUDED.d_dish_4, survey_day_responses.d_dish_4),
    d_dish_5      = COALESCE(EXCLUDED.d_dish_5, survey_day_responses.d_dish_5),
    dish_snapshot = COALESCE(EXCLUDED.dish_snapshot, survey_day_responses.dish_snapshot),
    edit_metadata = COALESCE(EXCLUDED.edit_metadata, survey_day_responses.edit_metadata),
    submitted_at  = COALESCE(EXCLUDED.submitted_at, survey_day_responses.submitted_at),
    updated_at    = GREATEST(survey_day_responses.updated_at, EXCLUDED.updated_at);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_flat_to_day_responses ON survey_submissions_flat;
CREATE TRIGGER trg_sync_flat_to_day_responses
  AFTER INSERT OR UPDATE ON survey_submissions_flat
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_flat_to_day_responses_trigger();
