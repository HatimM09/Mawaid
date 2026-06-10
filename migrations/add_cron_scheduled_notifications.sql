-- ══════════════════════════════════════════════════════════════
-- Al-Mawaid Scheduled Notifications — pg_cron Setup
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- Requires: pg_cron extension enabled in Supabase
-- ══════════════════════════════════════════════════════════════

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Set up cron job to run process-scheduled function every minute
-- This will automatically send scheduled broadcasts when their time arrives
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '* * * * *',  -- Every minute
  $$
  SELECT net.http_post(
    url := 'https://spciaktztqnjsttrtosu.supabase.co/functions/v1/process-scheduled',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- Alternative: If you prefer to use a secret instead of service role key
-- First set the secret: supabase secrets set CRON_SECRET=<your-random-uuid>
-- Then use this version:
/*
SELECT cron.schedule(
  'process-scheduled-broadcasts',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://spciaktztqnjsttrtosu.supabase.co/functions/v1/process-scheduled',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
*/

-- To verify the cron job is scheduled:
-- SELECT * FROM cron.job;

-- To unschedule (if needed):
-- SELECT cron.unschedule('process-scheduled-broadcasts');

-- To view cron job run history:
-- SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'process-scheduled-broadcasts') ORDER BY start_time DESC LIMIT 10;