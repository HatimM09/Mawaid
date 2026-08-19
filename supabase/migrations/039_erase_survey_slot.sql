-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Admin erase one day's lunch OR dinner (039)
--   erase_survey_slot(user_id, week_id, day, meal)
--     → clears ONLY that member's chosen meal for a single day:
--         • survey_day_responses   (canonical per-day row → l_*/d_* columns)
--         • survey_submissions_flat (legacy flat mirror → <day>_<meal>_* columns)
--     and records the erase in survey_write_log (via SECURITY DEFINER,
--     so the audit row survives even though the subject is another user).
--   SECURITY DEFINER + is_admin() guard — members are rejected server-side.
--   Idempotent — safe to re-run; a slot with no data simply returns 0s.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.erase_survey_slot(
  p_user_id uuid,
  p_week_id date,
  p_day text,
  p_meal text DEFAULT 'lunch'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meal text;
  v_day_rows bigint := 0;
  v_flat_rows bigint := 0;
  v_set text;
  v_sql text;
BEGIN
  -- Only admins may erase survey data.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can erase survey data.';
  END IF;

  IF p_user_id IS NULL OR p_week_id IS NULL OR p_day IS NULL THEN
    RAISE EXCEPTION 'user_id, week_id and day are required.';
  END IF;

  IF p_day NOT IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat') THEN
    RAISE EXCEPTION 'Invalid day. Expected mon..sat.';
  END IF;

  v_meal := CASE WHEN p_meal = 'dinner' THEN 'd' ELSE 'l' END;

  -- ── 1. Canonical day row: null out this meal's status + 14 dish slots ──
  SELECT string_agg(format('%I = NULL', v_meal || '_' || x), ', ')
  INTO v_set
  FROM unnest(ARRAY['status'] ||
              (SELECT array_agg('dish_' || i) FROM generate_series(1, 14) i)) AS x;

  EXECUTE format(
    'UPDATE survey_day_responses SET %s, updated_at = now()
     WHERE user_id = %L AND week_id = %L AND day = %L',
    v_set, p_user_id, p_week_id, p_day
  );
  GET DIAGNOSTICS v_day_rows = ROW_COUNT;

  -- ── 2. Flat mirror: clear the matching <day>_<meal>_* columns ──
  SELECT string_agg(format('%I = NULL', p_day || '_' || v_meal || '_' || x), ', ')
  INTO v_set
  FROM unnest(ARRAY['status'] ||
              (SELECT array_agg('dish_' || i) FROM generate_series(1, 14) i)) AS x;

  EXECUTE format(
    'UPDATE survey_submissions_flat SET %s, updated_at = now()
     WHERE user_id = %L AND week_id = %L',
    v_set, p_user_id, p_week_id
  );
  GET DIAGNOSTICS v_flat_rows = ROW_COUNT;

  -- ── 3. Audit: record WHO erased WHAT. The log row is created via the
  -- definer function so it is never blocked by the member-write RLS policy. ──
  INSERT INTO survey_write_log (user_id, week_id, day, action, payload, status)
  VALUES (
    auth.uid(), p_week_id, p_day, 'erase',
    jsonb_build_object('target_user', p_user_id, 'meal', p_meal,
                       'day_responses', v_day_rows, 'submissions', v_flat_rows),
    'success'
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_user_id, 'week_id', p_week_id,
                            'day', p_day, 'meal', p_meal,
                            'day_responses', v_day_rows,
                            'submissions', v_flat_rows);
END;
$$;

REVOKE ALL ON FUNCTION public.erase_survey_slot(uuid, date, text, text)
  FROM public, anon;

GRANT EXECUTE ON FUNCTION public.erase_survey_slot(uuid, date, text, text)
  TO authenticated, service_role;