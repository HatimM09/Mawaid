-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Override survey responses table (035)
--   A dedicated table for override survey responses, separate from
--   the regular survey_submissions_flat. This allows:
--   1. Clear distinction between regular and override fills
--   2. Override entries highlighted in admin tracking
--   3. Override entries highlighted in member's My Surveys
--   4. Override fills are fill-only (no edit after submission)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.survey_overrides (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id DATE NOT NULL,
  
  -- Per-slot statuses (same schema as survey_submissions_flat)
  mon_l_status TEXT, mon_l_dish_1 TEXT, mon_l_dish_2 TEXT, mon_l_dish_3 TEXT,
  mon_l_dish_4 TEXT, mon_l_dish_5 TEXT, mon_l_dish_6 TEXT, mon_l_dish_7 TEXT,
  mon_l_dish_8 TEXT, mon_l_dish_9 TEXT, mon_l_dish_10 TEXT, mon_l_dish_11 TEXT,
  mon_l_dish_12 TEXT, mon_l_dish_13 TEXT, mon_l_dish_14 TEXT,
  mon_d_status TEXT, mon_d_dish_1 TEXT, mon_d_dish_2 TEXT, mon_d_dish_3 TEXT,
  mon_d_dish_4 TEXT, mon_d_dish_5 TEXT, mon_d_dish_6 TEXT, mon_d_dish_7 TEXT,
  mon_d_dish_8 TEXT, mon_d_dish_9 TEXT, mon_d_dish_10 TEXT, mon_d_dish_11 TEXT,
  mon_d_dish_12 TEXT, mon_d_dish_13 TEXT, mon_d_dish_14 TEXT,
  
  tue_l_status TEXT, tue_l_dish_1 TEXT, tue_l_dish_2 TEXT, tue_l_dish_3 TEXT,
  tue_l_dish_4 TEXT, tue_l_dish_5 TEXT, tue_l_dish_6 TEXT, tue_l_dish_7 TEXT,
  tue_l_dish_8 TEXT, tue_l_dish_9 TEXT, tue_l_dish_10 TEXT, tue_l_dish_11 TEXT,
  tue_l_dish_12 TEXT, tue_l_dish_13 TEXT, tue_l_dish_14 TEXT,
  tue_d_status TEXT, tue_d_dish_1 TEXT, tue_d_dish_2 TEXT, tue_d_dish_3 TEXT,
  tue_d_dish_4 TEXT, tue_d_dish_5 TEXT, tue_d_dish_6 TEXT, tue_d_dish_7 TEXT,
  tue_d_dish_8 TEXT, tue_d_dish_9 TEXT, tue_d_dish_10 TEXT, tue_d_dish_11 TEXT,
  tue_d_dish_12 TEXT, tue_d_dish_13 TEXT, tue_d_dish_14 TEXT,
  
  wed_l_status TEXT, wed_l_dish_1 TEXT, wed_l_dish_2 TEXT, wed_l_dish_3 TEXT,
  wed_l_dish_4 TEXT, wed_l_dish_5 TEXT, wed_l_dish_6 TEXT, wed_l_dish_7 TEXT,
  wed_l_dish_8 TEXT, wed_l_dish_9 TEXT, wed_l_dish_10 TEXT, wed_l_dish_11 TEXT,
  wed_l_dish_12 TEXT, wed_l_dish_13 TEXT, wed_l_dish_14 TEXT,
  wed_d_status TEXT, wed_d_dish_1 TEXT, wed_d_dish_2 TEXT, wed_d_dish_3 TEXT,
  wed_d_dish_4 TEXT, wed_d_dish_5 TEXT, wed_d_dish_6 TEXT, wed_d_dish_7 TEXT,
  wed_d_dish_8 TEXT, wed_d_dish_9 TEXT, wed_d_dish_10 TEXT, wed_d_dish_11 TEXT,
  wed_d_dish_12 TEXT, wed_d_dish_13 TEXT, wed_d_dish_14 TEXT,
  
  thu_l_status TEXT, thu_l_dish_1 TEXT, thu_l_dish_2 TEXT, thu_l_dish_3 TEXT,
  thu_l_dish_4 TEXT, thu_l_dish_5 TEXT, thu_l_dish_6 TEXT, thu_l_dish_7 TEXT,
  thu_l_dish_8 TEXT, thu_l_dish_9 TEXT, thu_l_dish_10 TEXT, thu_l_dish_11 TEXT,
  thu_l_dish_12 TEXT, thu_l_dish_13 TEXT, thu_l_dish_14 TEXT,
  thu_d_status TEXT, thu_d_dish_1 TEXT, thu_d_dish_2 TEXT, thu_d_dish_3 TEXT,
  thu_d_dish_4 TEXT, thu_d_dish_5 TEXT, thu_d_dish_6 TEXT, thu_d_dish_7 TEXT,
  thu_d_dish_8 TEXT, thu_d_dish_9 TEXT, thu_d_dish_10 TEXT, thu_d_dish_11 TEXT,
  thu_d_dish_12 TEXT, thu_d_dish_13 TEXT, thu_d_dish_14 TEXT,
  
  fri_l_status TEXT, fri_l_dish_1 TEXT, fri_l_dish_2 TEXT, fri_l_dish_3 TEXT,
  fri_l_dish_4 TEXT, fri_l_dish_5 TEXT, fri_l_dish_6 TEXT, fri_l_dish_7 TEXT,
  fri_l_dish_8 TEXT, fri_l_dish_9 TEXT, fri_l_dish_10 TEXT, fri_l_dish_11 TEXT,
  fri_l_dish_12 TEXT, fri_l_dish_13 TEXT, fri_l_dish_14 TEXT,
  fri_d_status TEXT, fri_d_dish_1 TEXT, fri_d_dish_2 TEXT, fri_d_dish_3 TEXT,
  fri_d_dish_4 TEXT, fri_d_dish_5 TEXT, fri_d_dish_6 TEXT, fri_d_dish_7 TEXT,
  fri_d_dish_8 TEXT, fri_d_dish_9 TEXT, fri_d_dish_10 TEXT, fri_d_dish_11 TEXT,
  fri_d_dish_12 TEXT, fri_d_dish_13 TEXT, fri_d_dish_14 TEXT,
  
  sat_l_status TEXT, sat_l_dish_1 TEXT, sat_l_dish_2 TEXT, sat_l_dish_3 TEXT,
  sat_l_dish_4 TEXT, sat_l_dish_5 TEXT, sat_l_dish_6 TEXT, sat_l_dish_7 TEXT,
  sat_l_dish_8 TEXT, sat_l_dish_9 TEXT, sat_l_dish_10 TEXT, sat_l_dish_11 TEXT,
  sat_l_dish_12 TEXT, sat_l_dish_13 TEXT, sat_l_dish_14 TEXT,
  sat_d_status TEXT, sat_d_dish_1 TEXT, sat_d_dish_2 TEXT, sat_d_dish_3 TEXT,
  sat_d_dish_4 TEXT, sat_d_dish_5 TEXT, sat_d_dish_6 TEXT, sat_d_dish_7 TEXT,
  sat_d_dish_8 TEXT, sat_d_dish_9 TEXT, sat_d_dish_10 TEXT, sat_d_dish_11 TEXT,
  sat_d_dish_12 TEXT, sat_d_dish_13 TEXT, sat_d_dish_14 TEXT,
  
  -- Metadata
  thali_number TEXT,
  email TEXT,
  dish_snapshot JSONB DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Unique constraint: one override row per user per week
  UNIQUE(user_id, week_id)
);

-- RLS policies
ALTER TABLE public.survey_overrides ENABLE ROW LEVEL SECURITY;

-- Members can read their own override responses
CREATE POLICY "Members read own override" ON public.survey_overrides
  FOR SELECT USING (auth.uid() = user_id);

-- Members can upsert their own override responses
CREATE POLICY "Members upsert own override" ON public.survey_overrides
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members update own override" ON public.survey_overrides
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can read all override responses
CREATE POLICY "Admins read all overrides" ON public.survey_overrides
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Admins can delete override responses
CREATE POLICY "Admins delete overrides" ON public.survey_overrides
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin'
    ) OR EXISTS (
      SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_survey_overrides_user_week ON public.survey_overrides(user_id, week_id);
CREATE INDEX IF NOT EXISTS idx_survey_overrides_week ON public.survey_overrides(week_id);

-- Enable realtime so Supabase realtime subscriptions fire on changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.survey_overrides;
