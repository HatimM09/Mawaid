-- 027_enable_cron.sql
-- ═══════════════════════════════════════════════════════════════════
-- Wire up the scheduled automation pipeline with pg_cron.
--
-- Background: the edge functions `process-scheduled` (delivers scheduled
-- broadcasts + auto-publishes weekly menus) and `survey-digest` (auto-open/
-- close survey, reminders, daily digest) were deployed but NEVER invoked by
-- anything — so scheduled broadcasts sat in `broadcast_schedule` with status
-- `scheduled` forever and members never received them.
--
-- This migration registers both functions with pg_cron so they fire on
-- schedule. It is idempotent — re-running it re-schedules the same jobs.
-- ═══════════════════════════════════════════════════════════════════

-- 1. Enable extensions (safe no-ops when already enabled).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  CREATE EXTENSION IF NOT EXISTS pg_net;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron/pg_net unavailable: %', SQLERRM;
END $$;

-- 2. Register the cron jobs (only runs when pg_cron is present).
DO $$
DECLARE
  base_url text := 'https://pquusffhuholbnlmuyen.supabase.co/functions/v1';
  anon     text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxdXVzZmZodWhvbGJubG11eWVuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM3NzEzOTAsImV4cCI6MjA5OTM0NzM5MH0.lp8jDk4UalHg5dJHIxTinhqaCJ-OA1RVwcDjM3KxcTo';
  hdr      jsonb;
BEGIN
  IF to_regclass('cron.job') IS NULL THEN
    RAISE NOTICE 'pg_cron extension not available — skipping job registration. Enable it in the Supabase Dashboard (Database → Extensions) and re-run this script.';
    RETURN;
  END IF;

  -- Both edge functions have verify_jwt = false in supabase/config.toml,
  -- so the public anon key is sufficient to invoke them.
  hdr := jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', anon,
    'Authorization', 'Bearer ' || anon
  );

  -- ── Scheduled broadcasts + weekly menu auto-publish: every minute ──
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'am-process-scheduled';
  PERFORM cron.schedule(
    'am-process-scheduled',
    '* * * * *',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
           base_url || '/process-scheduled', hdr, '{}')
  );

  -- ── Survey auto-open: Saturday 20:00 ──
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'am-survey-auto-open';
  PERFORM cron.schedule(
    'am-survey-auto-open',
    '0 20 * * 6',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
           base_url || '/survey-digest', hdr, '{"action":"auto_open"}')
  );

  -- ── Survey auto-close: Monday 11:30 ──
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'am-survey-auto-close';
  PERFORM cron.schedule(
    'am-survey-auto-close',
    '30 11 * * 1',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
           base_url || '/survey-digest', hdr, '{"action":"auto_close"}')
  );

  -- ── Survey reminders: Mon–Sat every 30 min, 08:00–23:30 ──
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'am-survey-reminder';
  PERFORM cron.schedule(
    'am-survey-reminder',
    '*/30 8-23 * * 1-6',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
           base_url || '/survey-digest', hdr, '{"action":"survey_reminder"}')
  );

  -- ── Daily survey digest to admins: Mon–Sat 18:00 ──
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'am-survey-digest';
  PERFORM cron.schedule(
    'am-survey-digest',
    '0 18 * * 1-6',
    format('select net.http_post(url := %L, headers := %L::jsonb, body := %L::jsonb)',
           base_url || '/survey-digest', hdr, '{"action":"survey_digest"}')
  );

  RAISE NOTICE 'Al-Mawaid cron jobs registered: process-scheduled (1 min), survey auto-open, auto-close, reminders, digest.';
END $$;
