-- ══════════════════════════════════════════════════════════════
-- Al-Mawaid Weekly Menu — Scheduled Publishing
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- 1. Add publish_at column (NULL = draft, past = published, future = scheduled)
ALTER TABLE public.weekly_menu
  ADD COLUMN IF NOT EXISTS publish_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Drop old UNIQUE(day_name) constraint, add UNIQUE(week_start, day_name)
--    so we can have separate menus for different weeks.
DO $$
DECLARE
  old_constraint_name TEXT;
BEGIN
  FOR old_constraint_name IN
    SELECT con.conname
    FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'weekly_menu'
      AND con.contype = 'u'
      AND con.conkey = (
        SELECT array_agg(attnum) FROM pg_catalog.pg_attribute
        WHERE attrelid = rel.oid AND attname = 'day_name'
      )
      AND con.conkey IS NOT NULL
      AND array_length(con.conkey, 1) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.weekly_menu DROP CONSTRAINT %I', old_constraint_name);
    RAISE NOTICE 'Dropped old constraint: %', old_constraint_name;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_constraint con
    JOIN pg_catalog.pg_class rel ON rel.oid = con.conrelid
    WHERE rel.relname = 'weekly_menu'
      AND con.conname = 'weekly_menu_week_day_key'
  ) THEN
    ALTER TABLE public.weekly_menu
      ADD CONSTRAINT weekly_menu_week_day_key
      UNIQUE (week_start, day_name);
    RAISE NOTICE 'Added constraint: weekly_menu_week_day_key';
  END IF;
END $$;

-- 3. Index for efficient publish_at queries
CREATE INDEX IF NOT EXISTS idx_weekly_menu_publish_at
  ON public.weekly_menu (publish_at);

-- 4. Index for efficient week_start queries
CREATE INDEX IF NOT EXISTS idx_weekly_menu_week_start
  ON public.weekly_menu (week_start);
