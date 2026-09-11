-- 049 — Survey Cadence: 1 week (12) vs 2 weeks (24) at once
-- Admin toggle via app_settings key `survey_cadence` -> '1_week' | '2_weeks'
-- No schema change on survey_day_responses; each week stays as separate rows keyed by week_id.
-- Seeded idempotently so existing installs default to 1_week without jumble.

INSERT INTO app_settings (key, value, updated_at)
VALUES ('survey_cadence', '1_week', now())
ON CONFLICT (key) DO NOTHING;

-- Optional: ensure help text exists via comment
COMMENT ON TABLE app_settings IS 'survey_cadence: 1_week (12 meals) or 2_weeks (24 meals, Week 1 + Week 2 sealed, no overlay)';
