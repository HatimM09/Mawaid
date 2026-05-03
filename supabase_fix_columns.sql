-- ============================================================
-- AL-MAWAID — FIX EXISTING TABLES (Add missing columns)
-- Run this AFTER the main schema if tables already exist
-- ============================================================

-- ── thali_requests: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS request_type TEXT DEFAULT 'resume';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS from_date DATE DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS to_date DATE DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS extra_items JSONB DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS admin_note TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS user_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.thali_requests ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── queries: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS admin_reply TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.queries ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'open';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── daily_feedback: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.daily_feedback ADD COLUMN IF NOT EXISTS lunch_emoji TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.daily_feedback ADD COLUMN IF NOT EXISTS dinner_emoji TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.daily_feedback ADD COLUMN IF NOT EXISTS dinner_stars INT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.daily_feedback ADD COLUMN IF NOT EXISTS lunch_stars INT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── user_stats: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS thali_number TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── staff: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS area TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS avatar_url TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── weekly_menu: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.weekly_menu ADD COLUMN IF NOT EXISTS week_start DATE DEFAULT CURRENT_DATE;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.weekly_menu ADD COLUMN IF NOT EXISTS day_ar TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── inventory: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS category_id INT DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS subcategory TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'kg';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS low_stock_threshold NUMERIC DEFAULT 5;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS image_url TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── inventory_log: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS item_name TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS product_id BIGINT;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS product_name TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS type TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS qty NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS new_stock NUMERIC DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.inventory_log ADD COLUMN IF NOT EXISTS note TEXT DEFAULT '';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── notices: Add missing columns ──
DO $$ BEGIN
  ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS tone TEXT DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS sender_name TEXT DEFAULT 'Admin';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS target_user_id UUID DEFAULT NULL;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]';
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ DEFAULT now();
EXCEPTION WHEN duplicate_column THEN NULL; END $$;


-- ── Create tables that might not exist yet ──
CREATE TABLE IF NOT EXISTS public.khidmat_guzaar (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  phone       TEXT DEFAULT '',
  role        TEXT DEFAULT '',
  area        TEXT DEFAULT '',
  avatar_url  TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.app_settings (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL,
  subscription  JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, subscription)
);


-- ── Seed default settings if empty ──
INSERT INTO public.app_settings (key, value) VALUES
  ('upi_id', 'shydrabadwala53@okhdfcbank'),
  ('upi_amount', '400.00'),
  ('survey_msg', 'Survey opens Saturday at 8:00 PM and closes Monday at 10:00 AM.')
ON CONFLICT (key) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- DONE! All missing columns have been added.
-- ════════════════════════════════════════════════════════════
