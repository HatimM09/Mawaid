-- Change thali_number from INTEGER to TEXT to support alphanumeric values
-- (e.g. "A101", "B-202", "C_303")

DROP INDEX IF EXISTS idx_user_stats_thali;

ALTER TABLE user_stats
  ALTER COLUMN thali_number TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_user_stats_thali ON user_stats(thali_number);
