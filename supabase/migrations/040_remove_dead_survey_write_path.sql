-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Remove dead survey write path (040)
--   The client now writes survey_day_responses directly via .upsert()
--   (src/lib/submitSurvey.js) with its own client-side audit log. The
--   submit_survey_day RPC — and the submit-survey edge function that
--   wrapped it — are no longer called by anything, so the RPC is dropped.
--
--   This also makes survey_submissions_flat a pure legacy/read-only
--   table: nothing maintains it anymore. Reads keep it only as a
--   historical fallback via src/lib/surveyRows.js.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.submit_survey_day(uuid, date, text, jsonb, text, boolean);