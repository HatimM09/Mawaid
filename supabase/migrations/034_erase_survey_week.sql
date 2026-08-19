-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Admin erase weekly survey (034)
--   erase_survey_week(week_id)  → wipes EVERYTHING stored for one
--                                 survey week in a single transaction:
--                                   • survey_day_responses   (canonical per-day rows)
--                                   • survey_submissions_flat (flat mirror / dashboards)
--                                   • survey_write_log       (audit trail for that week)
--   SECURITY DEFINER + is_admin() guard, so only authenticated admins
--   can call it; members are rejected server-side. A short audit row is
--   written AFTER the deletes so the erase itself is recorded (and never
--   deleted by its own statement).
-- Idempotent — safe to re-run. Safe on a week with no data (returns 0s).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.erase_survey_week(p_week_id date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day bigint;
  v_flat bigint;
  v_log bigint;
BEGIN
  -- Only admins may erase survey data.
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can erase a survey week.';
  END IF;

  IF p_week_id IS NULL THEN
    RAISE EXCEPTION 'week_id is required.';
  END IF;

  -- ── 1. Wipe the week from every survey table (one transaction) ──
  WITH del AS (
    DELETE FROM survey_day_responses WHERE week_id = p_week_id RETURNING 1
  ) SELECT count(*) INTO v_day FROM del;

  WITH del AS (
    DELETE FROM survey_submissions_flat WHERE week_id = p_week_id RETURNING 1
  ) SELECT count(*) INTO v_flat FROM del;

  WITH del AS (
    DELETE FROM survey_write_log WHERE week_id = p_week_id RETURNING 1
  ) SELECT count(*) INTO v_log FROM del;

  -- ── 2. Audit the erase AFTER the deletes so the row survives ──
  INSERT INTO survey_write_log (user_id, week_id, day, action, payload, status, error)
  VALUES (
    auth.uid(), p_week_id, NULL, 'erase',
    jsonb_build_object('day_responses', v_day, 'submissions', v_flat, 'write_log', v_log),
    'success', NULL
  );

  RETURN jsonb_build_object('ok', true, 'week_id', p_week_id,
                            'day_responses', v_day,
                            'submissions', v_flat,
                            'write_log', v_log);
END;
$$;

REVOKE ALL ON FUNCTION public.erase_survey_week(date)
  FROM public, anon;

GRANT EXECUTE ON FUNCTION public.erase_survey_week(date)
  TO authenticated, service_role;
