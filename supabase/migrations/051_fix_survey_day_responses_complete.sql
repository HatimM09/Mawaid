-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Migration 051: Comprehensive Fix for Survey Day Responses
-- Ensures all survey submissions go to survey_day_responses cleanly
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Ensure survey_day_responses table exists with all required columns ──
CREATE TABLE IF NOT EXISTS public.survey_day_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id DATE NOT NULL,
  day TEXT NOT NULL CHECK (day IN ('mon', 'tue', 'wed', 'thu', 'fri', 'sat')),
  thali_number TEXT,
  email TEXT,
  l_status TEXT CHECK (l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  l_dish_1 TEXT, l_dish_2 TEXT, l_dish_3 TEXT, l_dish_4 TEXT, l_dish_5 TEXT,
  d_status TEXT CHECK (d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  d_dish_1 TEXT, d_dish_2 TEXT, d_dish_3 TEXT, d_dish_4 TEXT, d_dish_5 TEXT,
  dish_snapshot JSONB,
  edit_metadata JSONB,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_id, day)
);

-- Ensure all columns exist
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS thali_number TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS l_status TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS l_dish_1 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS l_dish_2 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS l_dish_3 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS l_dish_4 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS l_dish_5 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS d_status TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS d_dish_1 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS d_dish_2 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS d_dish_3 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS d_dish_4 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS d_dish_5 TEXT;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS dish_snapshot JSONB;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS edit_metadata JSONB;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.survey_day_responses ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Indexes for lightning-fast lookups
CREATE INDEX IF NOT EXISTS idx_survey_day_user_week ON public.survey_day_responses(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_survey_day_week ON public.survey_day_responses(week_id);
CREATE INDEX IF NOT EXISTS idx_survey_day_thali ON public.survey_day_responses(thali_number);
CREATE INDEX IF NOT EXISTS idx_survey_day_user_id ON public.survey_day_responses(user_id);

-- Enable RLS
ALTER TABLE public.survey_day_responses ENABLE ROW LEVEL SECURITY;

-- Reset and recreate clean RLS policies for survey_day_responses
DROP POLICY IF EXISTS "Users can read own day responses" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Users can insert own day responses" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Users can update own day responses" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Users can delete own day responses" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Admins can read all day responses" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Admins can insert any day response" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Admins can update any day response" ON public.survey_day_responses;
DROP POLICY IF EXISTS "Admins can delete day responses" ON public.survey_day_responses;

-- Helper admin check function safe against missing staff table
CREATE OR REPLACE FUNCTION public.is_admin_or_staff()
RETURNS BOOLEAN AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor', 'khidmat_guzar')) THEN
    RETURN TRUE;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'staff') THEN
    IF EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid()) THEN
      RETURN TRUE;
    END IF;
  END IF;
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- User Policies: Member can read, insert, update their own day responses
CREATE POLICY "Users can read own day responses"
  ON public.survey_day_responses FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_staff());

CREATE POLICY "Users can insert own day responses"
  ON public.survey_day_responses FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_staff());

CREATE POLICY "Users can update own day responses"
  ON public.survey_day_responses FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin_or_staff())
  WITH CHECK (auth.uid() = user_id OR public.is_admin_or_staff());

CREATE POLICY "Admins can delete day responses"
  ON public.survey_day_responses FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin_or_staff());

-- ── 2. Ensure survey_write_log exists and has robust policies ──
CREATE TABLE IF NOT EXISTS public.survey_write_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  week_id DATE,
  day TEXT,
  action TEXT DEFAULT 'submit',
  payload JSONB,
  status TEXT DEFAULT 'success',
  error TEXT,
  request_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.survey_write_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert write logs" ON public.survey_write_log;
DROP POLICY IF EXISTS "Users can read own write logs" ON public.survey_write_log;
DROP POLICY IF EXISTS "Admins can view all write logs" ON public.survey_write_log;
DROP POLICY IF EXISTS "Admins can insert write logs" ON public.survey_write_log;

CREATE POLICY "Users can insert write logs"
  ON public.survey_write_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Users can read own write logs"
  ON public.survey_write_log FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin_or_staff());

-- ── 3. Realtime Publication ──
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'survey_day_responses'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_day_responses;
  END IF;
END $$;
