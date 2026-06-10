-- FIX v2: Safely fixes the unique constraint without "already exists" errors
-- Uses PL/pgSQL to find and drop the old UNIQUE(user_id) constraint by its actual name,
-- and only adds UNIQUE(user_id, week_id) if it doesn't already exist.

DO $$
DECLARE
  old_constraint_name TEXT;
BEGIN
  -- 1. Find and drop ANY unique constraint on just (user_id) in survey_submissions_flat
  FOR old_constraint_name IN
    SELECT con.conname
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'survey_submissions_flat'
      AND con.contype = 'u'
      AND con.conkey = (
        SELECT array_agg(attnum) FROM pg_catalog.pg_attribute
        WHERE attrelid = rel.oid AND attname = 'user_id'
      )
      AND con.conkey IS NOT NULL
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.survey_submissions_flat DROP CONSTRAINT %I', old_constraint_name);
    RAISE NOTICE 'Dropped old constraint: %', old_constraint_name;
  END LOOP;

  -- 2. Add UNIQUE(user_id, week_id) only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'survey_submissions_flat'
      AND con.conname = 'survey_submissions_flat_user_week_key'
  ) THEN
    ALTER TABLE public.survey_submissions_flat
      ADD CONSTRAINT survey_submissions_flat_user_week_key
      UNIQUE (user_id, week_id);
    RAISE NOTICE 'Added new constraint: survey_submissions_flat_user_week_key';
  ELSE
    RAISE NOTICE 'Constraint survey_submissions_flat_user_week_key already exists, skipping.';
  END IF;
END $$;

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
