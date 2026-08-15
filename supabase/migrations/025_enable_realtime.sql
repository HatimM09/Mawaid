-- Enable Realtime replication for every table the app listens to via
-- postgres_changes. Without this, realtime sockets connect but never deliver
-- change events, so admin actions (e.g. opening the weekly survey from the
-- Automation page) never reach member devices until they reload the app.

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'app_settings',
    'broadcast_schedule',
    'daily_feedback',
    'inventory',
    'inventory_log',
    'notices',
    'notifications',
    'push_subscriptions',
    'queries',
    'staff',
    'survey_submissions_flat',
    'thali_requests',
    'user_stats'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
    END IF;
  END LOOP;
END $$;
