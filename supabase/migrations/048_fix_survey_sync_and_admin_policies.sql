-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Survey Sync, Realtime & Admin Policy Fixes (048)
--
-- 1. Enable Realtime replication on weekly_menu so changes made by
--    admins broadcast instantly to all connected member devices & tracking dashboards.
-- 2. Add admin INSERT policy on survey_day_responses (previously only auth.uid() = user_id
--    was permitted, which broke admin-driven saves, overrides, and seeding).
-- 3. Ensure survey_day_responses is in supabase_realtime.
-- 4. Add admin SELECT & INSERT policies on survey_write_log.
-- ═══════════════════════════════════════════════════════════════

-- 1. Enable Realtime on weekly_menu
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'weekly_menu'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.weekly_menu;
  END IF;
END $$;

-- 2. Ensure survey_day_responses has admin INSERT policy
DROP POLICY IF EXISTS "Admins can insert any day response" ON public.survey_day_responses;
CREATE POLICY "Admins can insert any day response"
  ON public.survey_day_responses FOR INSERT
  WITH CHECK (public.is_admin());

-- 3. Ensure survey_day_responses is in supabase_realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'survey_day_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_day_responses;
  END IF;
END $$;

-- 4. Ensure survey_write_log has admin policies
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'survey_write_log') THEN
    DROP POLICY IF EXISTS "Admins can view all write logs" ON public.survey_write_log;
    CREATE POLICY "Admins can view all write logs"
      ON public.survey_write_log FOR SELECT
      USING (public.is_admin());

    DROP POLICY IF EXISTS "Admins can insert write logs" ON public.survey_write_log;
    CREATE POLICY "Admins can insert write logs"
      ON public.survey_write_log FOR INSERT
      WITH CHECK (public.is_admin());
  END IF;
END $$;
