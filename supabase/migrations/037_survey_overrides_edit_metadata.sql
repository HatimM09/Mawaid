-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — survey_overrides metadata parity (037)
--   survey_overrides is the new primary survey table (from this Saturday
--   forward all writes go there). Its schema must match the other survey
--   tables so the shared write path and readers work identically:
--     • edit_metadata — JSONB edit-count map (used by the popup's
--       "Edited after submit" badge and edit counts). SurveyModal always
--       writes it; without this column the upsert fails with
--       'column edit_metadata of relation survey_overrides does not exist'.
--     • created_at — same default as survey_submissions_flat /
--       survey_day_responses for parity.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.survey_overrides
  ADD COLUMN IF NOT EXISTS edit_metadata JSONB;

ALTER TABLE public.survey_overrides
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
