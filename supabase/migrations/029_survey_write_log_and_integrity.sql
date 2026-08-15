-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Survey write integrity (029)
--  1. survey_write_log — every member survey write (success or error)
--     is recorded here by the submit-survey edge function so failed
--     saves are visible instead of silently swallowed.
--  2. submitted_at — timestamp set by the edge function when a write
--     covers all 12 slots (a full weekly submission).
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Survey write log ──
CREATE TABLE IF NOT EXISTS survey_write_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  week_id DATE,
  action TEXT NOT NULL DEFAULT 'submit',
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_write_log_user ON survey_write_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_write_log_week ON survey_write_log(week_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_write_log_status ON survey_write_log(status, created_at DESC);

ALTER TABLE survey_write_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log; the edge function writes via the service
-- role key (bypasses RLS), and members never need to read it.
DROP POLICY IF EXISTS "Admins can read survey write log" ON survey_write_log;
CREATE POLICY "Admins can read survey write log"
  ON survey_write_log FOR SELECT
  USING (public.is_admin());

-- ── 2. submitted_at marker on survey_submissions_flat ──
-- Set by the submit-survey edge function when a write covers all 12 slots.
ALTER TABLE survey_submissions_flat
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Composite lookup index for the exact (user_id, week_id) row the app and
-- the tracker read/write on every survey interaction.
CREATE INDEX IF NOT EXISTS idx_survey_user_week
  ON survey_submissions_flat(user_id, week_id);
