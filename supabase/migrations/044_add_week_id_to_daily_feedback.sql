-- Feedback must renew every week: previously UNIQUE(user_id, day) where `day`
-- is a weekday name, so last Monday's row kept showing "Rated!" forever.
-- Adding `week_id` (Monday of the feedback's week, YYYY-MM-DD) makes each
-- weekday's rating slot fresh again every new week.

ALTER TABLE daily_feedback ADD COLUMN IF NOT EXISTS week_id TEXT;

-- Backfill existing rows from their creation timestamp (UTC ISO-week Monday).
UPDATE daily_feedback
SET week_id = to_char(
  (created_at AT TIME ZONE 'UTC')::date - (EXTRACT(ISODOW FROM created_at)::int - 1),
  'YYYY-MM-DD'
)
WHERE week_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_feedback_week ON daily_feedback(week_id);

ALTER TABLE daily_feedback DROP CONSTRAINT IF EXISTS daily_feedback_user_id_day_key;
ALTER TABLE daily_feedback
  DROP CONSTRAINT IF EXISTS daily_feedback_user_id_day_week_id_key,
  ADD CONSTRAINT daily_feedback_user_id_day_week_id_key UNIQUE (user_id, day, week_id);
