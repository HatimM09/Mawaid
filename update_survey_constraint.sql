-- Add week_id to survey_submissions_flat and update unique constraint
DO $$ 
BEGIN
  -- 1. Add week_id column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='survey_submissions_flat' AND column_name='week_id') THEN
    ALTER TABLE public.survey_submissions_flat ADD COLUMN week_id TEXT DEFAULT '';
  END IF;

  -- 2. Update existing rows to have a default week_id if they are empty
  -- We'll use the Monday of the current week as a default for existing data
  UPDATE public.survey_submissions_flat 
  SET week_id = to_char(date_trunc('week', now()), 'YYYY-MM-DD')
  WHERE week_id = '' OR week_id IS NULL;

  -- 3. Remove the old unique constraint on user_id
  ALTER TABLE public.survey_submissions_flat DROP CONSTRAINT IF EXISTS survey_submissions_flat_user_id_key;

  -- 4. Add new unique constraint on (user_id, week_id)
  -- This allows one record per user per week.
  -- (Actually, the user wants only ONE record total, but wants to keep the 'previous' one until they submit the 'new' one)
  -- So we'll keep the UNIQUE(user_id, week_id) to allow two records to coexist temporarily during the transition.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'survey_submissions_flat_user_week_key') THEN
    ALTER TABLE public.survey_submissions_flat ADD CONSTRAINT survey_submissions_flat_user_week_key UNIQUE(user_id, week_id);
  END IF;

END $$;
