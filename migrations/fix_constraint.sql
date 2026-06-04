-- FIX: survey_submissions_flat unique constraint & missing function
-- SAFE: No data loss. Uses ALTER TABLE (not DROP/CREATE).

-- 1. Drop the old UNIQUE(user_id) constraint
ALTER TABLE public.survey_submissions_flat
  DROP CONSTRAINT IF EXISTS survey_submissions_flat_user_id_key;

-- 2. Add the correct UNIQUE(user_id, week_id) constraint
ALTER TABLE public.survey_submissions_flat
  ADD CONSTRAINT survey_submissions_flat_user_week_key
  UNIQUE (user_id, week_id);

-- 3. Add surveys_count column to user_stats if it doesn't exist
ALTER TABLE public.user_stats
  ADD COLUMN IF NOT EXISTS surveys_count INTEGER DEFAULT 0;

-- 4. Create the increment_user_surveys function
CREATE OR REPLACE FUNCTION public.increment_user_surveys(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_count INTEGER;
BEGIN
  INSERT INTO public.user_stats (user_id, surveys_count)
  VALUES (p_user_id, 1)
  ON CONFLICT (user_id)
  DO UPDATE SET surveys_count = COALESCE(user_stats.surveys_count, 0) + 1
  RETURNING surveys_count INTO new_count;

  RETURN new_count;
END;
$$;
