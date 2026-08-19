-- AL-MAWAID - SQL Editor bundle: migrations 017-031 (merged, idempotent). Run in Supabase SQL Editor.
-- 001-016 are already applied to project pquusffhuholbnlmuyen and intentionally excluded.

-- ===== 017_add_notifications_enabled.sql =====
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT TRUE;

-- ===== 018_alter_push_subscriptions_token_type.sql =====
-- Add 'fcm' to the token_type CHECK constraint to support Capacitor native FCM push
ALTER TABLE push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_token_type_check;

ALTER TABLE push_subscriptions
ADD CONSTRAINT push_subscriptions_token_type_check
CHECK (token_type IN ('webpush', 'expo', 'fcm'));

-- ===== 018_fix_is_admin.sql =====
-- Update is_admin() to also check user_stats.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ===== 019_add_sender_name_to_notifications.sql =====
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- ===== 019_inventory_manager_rls.sql =====
-- Add RLS policies for inventory_manager role
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory' AND policyname = 'Inventory managers can CRUD inventory') THEN
    CREATE POLICY "Inventory managers can CRUD inventory" ON public.inventory FOR ALL USING (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_categories' AND policyname = 'Inventory managers can CRUD categories') THEN
    CREATE POLICY "Inventory managers can CRUD categories" ON public.inventory_categories FOR ALL USING (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'inventory_log' AND policyname = 'Inventory managers can CRUD inventory log') THEN
    CREATE POLICY "Inventory managers can CRUD inventory log" ON public.inventory_log FOR ALL USING (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
      OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
    );
  END IF;
END $$;

-- ===== 020_change_thali_number_to_text.sql =====
-- Change thali_number from INTEGER to TEXT to support alphanumeric values
-- (e.g. "A101", "B-202", "C_303")

DROP INDEX IF EXISTS idx_user_stats_thali;

ALTER TABLE user_stats
  ALTER COLUMN thali_number TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_user_stats_thali ON user_stats(thali_number);

-- ===== 021_ensure_all_schema.sql =====
-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Comprehensive Schema Ensurer
-- Run this in Supabase SQL Editor to fix any missing/broken schema
-- Idempotent — safe to re-run
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Helper Functions ──

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- ── 2. Tables ──

CREATE TABLE IF NOT EXISTS staff (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'khidmat_guzar', 'supervisor', 'khidmat', 'inventory_manager')),
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  thali_number TEXT,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'khidmat_guzar', 'supervisor', 'inventory_manager', 'cook')),
  avatar_url TEXT,
  snack_defaults JSONB,
  notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS khidmat_guzaar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'khidmat_guzar',
  phone TEXT,
  email TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS weekly_menu (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  day_name TEXT NOT NULL CHECK (day_name IN ('monday','tuesday','wednesday','thursday','friday','saturday')),
  day_ar TEXT DEFAULT '',
  lunch TEXT DEFAULT '',
  dinner TEXT DEFAULT '',
  publish_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week_start, day_name)
);

CREATE TABLE IF NOT EXISTS survey_submissions_flat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id DATE NOT NULL,
  thali_number TEXT,
  email TEXT,
  mon_l_status TEXT CHECK (mon_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  mon_l_dish_1 TEXT, mon_l_dish_2 TEXT, mon_l_dish_3 TEXT, mon_l_dish_4 TEXT,
  mon_d_status TEXT CHECK (mon_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  mon_d_dish_1 TEXT, mon_d_dish_2 TEXT, mon_d_dish_3 TEXT, mon_d_dish_4 TEXT,
  tue_l_status TEXT CHECK (tue_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  tue_l_dish_1 TEXT, tue_l_dish_2 TEXT, tue_l_dish_3 TEXT, tue_l_dish_4 TEXT,
  tue_d_status TEXT CHECK (tue_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  tue_d_dish_1 TEXT, tue_d_dish_2 TEXT, tue_d_dish_3 TEXT, tue_d_dish_4 TEXT,
  wed_l_status TEXT CHECK (wed_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  wed_l_dish_1 TEXT, wed_l_dish_2 TEXT, wed_l_dish_3 TEXT, wed_l_dish_4 TEXT,
  wed_d_status TEXT CHECK (wed_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  wed_d_dish_1 TEXT, wed_d_dish_2 TEXT, wed_d_dish_3 TEXT, wed_d_dish_4 TEXT,
  thu_l_status TEXT CHECK (thu_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  thu_l_dish_1 TEXT, thu_l_dish_2 TEXT, thu_l_dish_3 TEXT, thu_l_dish_4 TEXT,
  thu_d_status TEXT CHECK (thu_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  thu_d_dish_1 TEXT, thu_d_dish_2 TEXT, thu_d_dish_3 TEXT, thu_d_dish_4 TEXT,
  fri_l_status TEXT CHECK (fri_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  fri_l_dish_1 TEXT, fri_l_dish_2 TEXT, fri_l_dish_3 TEXT, fri_l_dish_4 TEXT,
  fri_d_status TEXT CHECK (fri_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  fri_d_dish_1 TEXT, fri_d_dish_2 TEXT, fri_d_dish_3 TEXT, fri_d_dish_4 TEXT,
  sat_l_status TEXT CHECK (sat_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  sat_l_dish_1 TEXT, sat_l_dish_2 TEXT, sat_l_dish_3 TEXT, sat_l_dish_4 TEXT,
  sat_d_status TEXT CHECK (sat_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  sat_d_dish_1 TEXT, sat_d_dish_2 TEXT, sat_d_dish_3 TEXT, sat_d_dish_4 TEXT,
  edit_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_id)
);

CREATE TABLE IF NOT EXISTS daily_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  lunch_stars INTEGER CHECK (lunch_stars BETWEEN 1 AND 5),
  lunch_emoji TEXT,
  dinner_stars INTEGER CHECK (dinner_stars BETWEEN 1 AND 5),
  dinner_emoji TEXT,
  lunch_comment TEXT,
  dinner_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day)
);

CREATE TABLE IF NOT EXISTS thali_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('resume', 'stop', 'extra', 'miqaat', 'change')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  from_date DATE,
  to_date DATE,
  meal_type TEXT CHECK (meal_type IN ('lunch', 'dinner', 'both')),
  details TEXT,
  extra_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  comment TEXT NOT NULL,
  media JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  body TEXT,
  sender_name TEXT DEFAULT 'System',
  media JSONB,
  url TEXT DEFAULT '/',
  type TEXT NOT NULL DEFAULT 'info',
  tone TEXT,
  channel TEXT DEFAULT 'in-app' CHECK (channel IN ('in-app', 'push', 'both')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  category_id INTEGER REFERENCES inventory_categories(id) ON DELETE SET NULL,
  category TEXT,
  subcategory TEXT DEFAULT '',
  unit TEXT NOT NULL DEFAULT 'kg' CHECK (unit IN ('kg', 'L', 'pcs', 'pkts', 'rolls')),
  stock DECIMAL(10, 2) NOT NULL DEFAULT 0,
  low_stock DECIMAL(10, 2) DEFAULT 10,
  low_stock_threshold DECIMAL(10, 2) DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS inventory_log (
  id SERIAL PRIMARY KEY,
  item_id INTEGER REFERENCES inventory(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('add', 'remove')),
  quantity DECIMAL(10, 2) NOT NULL,
  old_stock DECIMAL(10, 2),
  new_stock DECIMAL(10, 2),
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token TEXT,
  subscription_json TEXT,
  token_type TEXT NOT NULL CHECK (token_type IN ('webpush', 'expo')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token_type)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'survey', 'survey_reminder', 'survey_digest', 'menu', 'broadcast')),
  url TEXT DEFAULT '/',
  created_at TIMESTAMPTZ DEFAULT now(),
  sender_name TEXT
);

-- Add sender_name column if missing
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sender_name TEXT;

-- Add extra_mode column if missing (Addition / Deduction extra food requests)
ALTER TABLE thali_requests ADD COLUMN IF NOT EXISTS extra_mode TEXT DEFAULT 'addition' CHECK (extra_mode IN ('addition', 'deduction'));

CREATE TABLE IF NOT EXISTS broadcast_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sender_name TEXT DEFAULT 'Admin',
  tone TEXT,
  media_url TEXT,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific', 'admins', 'opt_in', 'opt_out')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS broadcast_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id UUID REFERENCES notices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  sender_name TEXT DEFAULT 'System',
  tone TEXT,
  media_url TEXT,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific', 'admins', 'opt_in', 'opt_out')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'in-app' CHECK (channel IN ('in-app', 'push', 'both')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'processing', 'sending', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Update status check constraint if old constraint still exists
ALTER TABLE broadcast_schedule DROP CONSTRAINT IF EXISTS broadcast_schedule_status_check;
ALTER TABLE broadcast_schedule ADD CONSTRAINT broadcast_schedule_status_check
  CHECK (status IN ('scheduled', 'processing', 'sending', 'sent', 'failed'));

-- ── 3. Indexes ──

CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);
CREATE INDEX IF NOT EXISTS idx_user_stats_email ON user_stats(email);
CREATE INDEX IF NOT EXISTS idx_user_stats_role ON user_stats(role);
CREATE INDEX IF NOT EXISTS idx_user_stats_thali ON user_stats(thali_number);
CREATE INDEX IF NOT EXISTS idx_weekly_menu_week ON weekly_menu(week_start);
CREATE INDEX IF NOT EXISTS idx_survey_week ON survey_submissions_flat(week_id);
CREATE INDEX IF NOT EXISTS idx_survey_user ON survey_submissions_flat(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_day ON daily_feedback(day);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON daily_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_thali_requests_user ON thali_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_thali_requests_status ON thali_requests(status);
CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);
CREATE INDEX IF NOT EXISTS idx_notices_type ON notices(type);
CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_category ON inventory(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_item ON inventory_log(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_log_date ON inventory_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_broadcast_status ON broadcast_schedule(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_scheduled ON broadcast_schedule(scheduled_for);

-- ── 4. Row Level Security ──

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE khidmat_guzaar ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_submissions_flat ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE thali_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcast_schedule ENABLE ROW LEVEL SECURITY;

-- ── 5. RLS Policies ──

-- Staff
DROP POLICY IF EXISTS "Users can read own staff record" ON staff;
DROP POLICY IF EXISTS "Admins can read all staff" ON staff;
DROP POLICY IF EXISTS "Admins can insert staff" ON staff;
DROP POLICY IF EXISTS "Admins can update staff" ON staff;
DROP POLICY IF EXISTS "Admins can delete staff" ON staff;
DROP POLICY IF EXISTS "Allow first admin bootstrap" ON staff;
CREATE POLICY "Users can read own staff record" ON staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all staff" ON staff FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert staff" ON staff FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update staff" ON staff FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete staff" ON staff FOR DELETE USING (public.is_admin());
CREATE POLICY "Allow first admin bootstrap" ON staff FOR INSERT WITH CHECK (NOT EXISTS (SELECT 1 FROM staff) AND role = 'admin');

-- user_stats
DROP POLICY IF EXISTS "Users can read own stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can read all user stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can insert user stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can update user stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can delete user stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;
CREATE POLICY "Users can read own stats" ON user_stats FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all user stats" ON user_stats FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert user stats" ON user_stats FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update user stats" ON user_stats FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete user stats" ON user_stats FOR DELETE USING (public.is_admin());
CREATE POLICY "Users can insert own stats" ON user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

-- khidmat_guzaar
DROP POLICY IF EXISTS "Anyone can read khidmat guzaar" ON khidmat_guzaar;
DROP POLICY IF EXISTS "Admins can manage khidmat guzaar" ON khidmat_guzaar;
DROP POLICY IF EXISTS "Admins can update khidmat guzaar" ON khidmat_guzaar;
DROP POLICY IF EXISTS "Admins can delete khidmat guzaar" ON khidmat_guzaar;
CREATE POLICY "Anyone can read khidmat guzaar" ON khidmat_guzaar FOR SELECT USING (true);
CREATE POLICY "Admins can manage khidmat guzaar" ON khidmat_guzaar FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update khidmat guzaar" ON khidmat_guzaar FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete khidmat guzaar" ON khidmat_guzaar FOR DELETE USING (public.is_admin());

-- weekly_menu
DROP POLICY IF EXISTS "Anyone can read weekly menu" ON weekly_menu;
DROP POLICY IF EXISTS "Admins can manage weekly menu" ON weekly_menu;
DROP POLICY IF EXISTS "Admins can update weekly menu" ON weekly_menu;
DROP POLICY IF EXISTS "Admins can delete weekly menu" ON weekly_menu;
CREATE POLICY "Anyone can read weekly menu" ON weekly_menu FOR SELECT USING (true);
CREATE POLICY "Admins can manage weekly menu" ON weekly_menu FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update weekly menu" ON weekly_menu FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete weekly menu" ON weekly_menu FOR DELETE USING (public.is_admin());

-- survey_submissions_flat
DROP POLICY IF EXISTS "Users can read own submissions" ON survey_submissions_flat;
DROP POLICY IF EXISTS "Admins can read all submissions" ON survey_submissions_flat;
DROP POLICY IF EXISTS "Users can insert own submissions" ON survey_submissions_flat;
DROP POLICY IF EXISTS "Users can update own submissions" ON survey_submissions_flat;
DROP POLICY IF EXISTS "Admins can update any submission" ON survey_submissions_flat;
DROP POLICY IF EXISTS "Admins can delete submissions" ON survey_submissions_flat;
CREATE POLICY "Users can read own submissions" ON survey_submissions_flat FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all submissions" ON survey_submissions_flat FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can insert own submissions" ON survey_submissions_flat FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own submissions" ON survey_submissions_flat FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any submission" ON survey_submissions_flat FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete submissions" ON survey_submissions_flat FOR DELETE USING (public.is_admin());

-- daily_feedback
DROP POLICY IF EXISTS "Users can read own feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Admins can read all feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON daily_feedback;
CREATE POLICY "Users can read own feedback" ON daily_feedback FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all feedback" ON daily_feedback FOR SELECT USING (public.is_admin());
CREATE POLICY "Users can insert own feedback" ON daily_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback" ON daily_feedback FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can delete feedback" ON daily_feedback FOR DELETE USING (public.is_admin());

-- thali_requests
DROP POLICY IF EXISTS "Users can read own requests" ON thali_requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON thali_requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON thali_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON thali_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON thali_requests;
CREATE POLICY "Users can read own requests" ON thali_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own requests" ON thali_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all requests" ON thali_requests FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update requests" ON thali_requests FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete requests" ON thali_requests FOR DELETE USING (public.is_admin());

-- queries
DROP POLICY IF EXISTS "Users can read own queries" ON queries;
DROP POLICY IF EXISTS "Users can insert own queries" ON queries;
DROP POLICY IF EXISTS "Admins can read all queries" ON queries;
DROP POLICY IF EXISTS "Admins can update queries" ON queries;
DROP POLICY IF EXISTS "Admins can delete queries" ON queries;
CREATE POLICY "Users can read own queries" ON queries FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own queries" ON queries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can read all queries" ON queries FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update queries" ON queries FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete queries" ON queries FOR DELETE USING (public.is_admin());

-- notices
DROP POLICY IF EXISTS "Anyone can read notices" ON notices;
DROP POLICY IF EXISTS "Admins can insert notices" ON notices;
DROP POLICY IF EXISTS "Admins can update notices" ON notices;
DROP POLICY IF EXISTS "Admins can delete notices" ON notices;
CREATE POLICY "Anyone can read notices" ON notices FOR SELECT USING (true);
CREATE POLICY "Admins can insert notices" ON notices FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update notices" ON notices FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete notices" ON notices FOR DELETE USING (public.is_admin());

-- inventory
DROP POLICY IF EXISTS "Anyone can read inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can delete inventory" ON inventory;
DROP POLICY IF EXISTS "Inventory managers can CRUD inventory" ON inventory;
CREATE POLICY "Anyone can read inventory" ON inventory FOR SELECT USING (true);
CREATE POLICY "Admins can insert inventory" ON inventory FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update inventory" ON inventory FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete inventory" ON inventory FOR DELETE USING (public.is_admin());
CREATE POLICY "Inventory managers can CRUD inventory" ON inventory FOR ALL USING (
  EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
  OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
  OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
);

-- inventory_categories
DROP POLICY IF EXISTS "Anyone can read categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admins can update categories" ON inventory_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON inventory_categories;
DROP POLICY IF EXISTS "Inventory managers can CRUD categories" ON inventory_categories;
CREATE POLICY "Anyone can read categories" ON inventory_categories FOR SELECT USING (true);
CREATE POLICY "Admins can manage categories" ON inventory_categories FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update categories" ON inventory_categories FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete categories" ON inventory_categories FOR DELETE USING (public.is_admin());
CREATE POLICY "Inventory managers can CRUD categories" ON inventory_categories FOR ALL USING (
  EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
  OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
  OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
);

-- inventory_log
DROP POLICY IF EXISTS "Anyone can read inventory log" ON inventory_log;
DROP POLICY IF EXISTS "Admins can insert inventory log" ON inventory_log;
DROP POLICY IF EXISTS "Inventory managers can CRUD inventory log" ON inventory_log;
CREATE POLICY "Anyone can read inventory log" ON inventory_log FOR SELECT USING (true);
CREATE POLICY "Admins can insert inventory log" ON inventory_log FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Inventory managers can CRUD inventory log" ON inventory_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
  OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.staff WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
  OR EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role IN ('admin', 'inventory_manager'))
);

-- app_settings
DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can insert app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON app_settings;
CREATE POLICY "Anyone can read app settings" ON app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert app settings" ON app_settings FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update app settings" ON app_settings FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete app settings" ON app_settings FOR DELETE USING (public.is_admin());

-- push_subscriptions
DROP POLICY IF EXISTS "Users can read own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can insert own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can update own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Users can delete own subscriptions" ON push_subscriptions;
DROP POLICY IF EXISTS "Admins can read all subscriptions" ON push_subscriptions;
CREATE POLICY "Users can read own subscriptions" ON push_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscriptions" ON push_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own subscriptions" ON push_subscriptions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own subscriptions" ON push_subscriptions FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all subscriptions" ON push_subscriptions FOR SELECT USING (public.is_admin());

-- notifications
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
CREATE POLICY "Users can read own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can insert notifications" ON notifications FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "System can insert notifications" ON notifications FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- broadcast_templates
DROP POLICY IF EXISTS "Admins can read templates" ON broadcast_templates;
DROP POLICY IF EXISTS "Admins can insert templates" ON broadcast_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON broadcast_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON broadcast_templates;
CREATE POLICY "Admins can read templates" ON broadcast_templates FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert templates" ON broadcast_templates FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update templates" ON broadcast_templates FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete templates" ON broadcast_templates FOR DELETE USING (public.is_admin());

-- broadcast_schedule
DROP POLICY IF EXISTS "Admins can read schedule" ON broadcast_schedule;
DROP POLICY IF EXISTS "Admins can insert schedule" ON broadcast_schedule;
DROP POLICY IF EXISTS "Admins can update schedule" ON broadcast_schedule;
DROP POLICY IF EXISTS "Admins can delete schedule" ON broadcast_schedule;
CREATE POLICY "Admins can read schedule" ON broadcast_schedule FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can insert schedule" ON broadcast_schedule FOR INSERT WITH CHECK (public.is_admin());
CREATE POLICY "Admins can update schedule" ON broadcast_schedule FOR UPDATE USING (public.is_admin());
CREATE POLICY "Admins can delete schedule" ON broadcast_schedule FOR DELETE USING (public.is_admin());

-- ── 6. Triggers ──

DROP TRIGGER IF EXISTS update_staff_updated_at ON staff;
CREATE TRIGGER update_staff_updated_at BEFORE UPDATE ON staff FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;
CREATE TRIGGER update_user_stats_updated_at BEFORE UPDATE ON user_stats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_weekly_menu_updated_at ON weekly_menu;
CREATE TRIGGER update_weekly_menu_updated_at BEFORE UPDATE ON weekly_menu FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_survey_submissions_flat_updated_at ON survey_submissions_flat;
CREATE TRIGGER update_survey_submissions_flat_updated_at BEFORE UPDATE ON survey_submissions_flat FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_thali_requests_updated_at ON thali_requests;
CREATE TRIGGER update_thali_requests_updated_at BEFORE UPDATE ON thali_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_queries_updated_at ON queries;
CREATE TRIGGER update_queries_updated_at BEFORE UPDATE ON queries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_inventory_updated_at ON inventory;
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_push_subscriptions_updated_at ON push_subscriptions;
CREATE TRIGGER update_push_subscriptions_updated_at BEFORE UPDATE ON push_subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_broadcast_schedule_updated_at ON broadcast_schedule;
CREATE TRIGGER update_broadcast_schedule_updated_at BEFORE UPDATE ON broadcast_schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 7. Auth Trigger ──

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, email, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'display_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'member')
  )
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        name = CASE WHEN EXCLUDED.name != '' THEN EXCLUDED.name ELSE user_stats.name END;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- DONE — All schema is now ensured
-- ═══════════════════════════════════════════════════════════════

-- ===== 022_add_avatar_url_to_khidmat_guzaar.sql =====
ALTER TABLE khidmat_guzaar ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- ===== 023_fix_notifications_schema.sql =====
-- Fix notifications schema so all in-app notification flows work correctly.

-- 1. Drop the restrictive type CHECK — the app uses types like 'new_request',
--    'new_query', 'request_approved', 'request_rejected', 'query_resolved',
--    'query_reply', 'test' which are not in the original allow-list.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Allow a member to insert a notification row for themselves (e.g. the
--    "Weekly Survey Submitted" confirmation). Read/delete stay restricted to
--    the owner; admin + service_role inserts continue to work as before.
DROP POLICY IF EXISTS "Members can insert own notifications" ON notifications;
CREATE POLICY "Members can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ===== 024_rewrite_avatar_urls.sql =====
UPDATE user_stats
SET avatar_url = replace(avatar_url, 'https://xmlmfijikkptvwbkkoil.supabase.co', 'https://pquusffhuholbnlmuyen.supabase.co')
WHERE avatar_url LIKE '%xmlmfijikkptvwbkkoil.supabase.co%';

UPDATE khidmat_guzaar
SET avatar_url = replace(avatar_url, 'https://xmlmfijikkptvwbkkoil.supabase.co', 'https://pquusffhuholbnlmuyen.supabase.co')
WHERE avatar_url LIKE '%xmlmfijikkptvwbkkoil.supabase.co%';

-- ===== 025_enable_realtime.sql =====
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

-- ===== 026_add_dish_snapshot.sql =====
-- Add a per-slot dish-name snapshot to survey_submissions_flat.
--
-- Responses are stored positionally (mon_l_dish_1 … dish_6), so dish names
-- are normally resolved from the CURRENT menu — which mislabels responses the
-- moment the admin edits the menu after a member submits. Every writer now
-- stores the dish list it saved against in `dish_snapshot` (keyed by slot,
-- e.g. { "mon_l": ["Dish A", "Dish B"], "tue_d": [...] }) and every reader
-- resolves names from the snapshot, falling back to the current menu.

ALTER TABLE survey_submissions_flat
  ADD COLUMN IF NOT EXISTS dish_snapshot JSONB DEFAULT '{}'::jsonb;

-- ===== 027_enable_cron.sql =====
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

-- ===== 028_add_extra_mode.sql =====
-- Add extra_mode column to thali_requests
-- Used by "Add Extra Food" requests to distinguish Addition vs Deduction
ALTER TABLE thali_requests ADD COLUMN IF NOT EXISTS extra_mode TEXT DEFAULT 'addition' CHECK (extra_mode IN ('addition', 'deduction'));

-- ===== 029_survey_write_log_and_integrity.sql =====
-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Survey write integrity (029)
--  1. survey_write_log — every member survey write (success or error)
--     is recorded here by the submit-survey edge function so failed
--     saves are visible instead of silently swallowed.
--  2. submitted_at — timestamp set by the edge function when a write
--     covers all 12 slots (a full weekly submission).
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. Survey write log ──
CREATE TABLE IF NOT EXISTS survey_write_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  week_id DATE,
  action TEXT NOT NULL DEFAULT 'submit',
  payload JSONB,
  status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'error')),
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_write_log_user ON survey_write_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_write_log_week ON survey_write_log(week_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_survey_write_log_status ON survey_write_log(status, created_at DESC);

ALTER TABLE survey_write_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the log; the edge function writes via the service
-- role key (bypasses RLS), and members never need to read it.
DROP POLICY IF EXISTS "Admins can read survey write log" ON survey_write_log;
CREATE POLICY "Admins can read survey write log"
  ON survey_write_log FOR SELECT
  USING (public.is_admin());

-- ── 2. submitted_at marker on survey_submissions_flat ──
-- Set by the submit-survey edge function when a write covers all 12 slots.
ALTER TABLE survey_submissions_flat
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

-- Composite lookup index for the exact (user_id, week_id) row the app and
-- the tracker read/write on every survey interaction.
CREATE INDEX IF NOT EXISTS idx_survey_user_week
  ON survey_submissions_flat(user_id, week_id);

-- ===== 030_add_dish_columns_7_to_14.sql =====
-- Add dish_7 … dish_14 columns for all day+meal combos.
-- The admin menu editor allows up to MAX_DISHES_PER_MEAL = 14 dishes per meal,
-- but survey_submissions_flat only had dish_1 … dish_6 — menus with 7+ dishes
-- silently dropped every answer beyond the 6th. Idempotent — safe to re-run.
ALTER TABLE survey_submissions_flat
  ADD COLUMN IF NOT EXISTS mon_l_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_14 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_7 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_8 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_9 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_10 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_11 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_12 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_13 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_14 TEXT;

-- ===== 031_submit_survey_rpc.sql =====
-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Atomic survey submission (031)
--   submit_survey(p_user_id, p_week_id, p_payload, p_request_id)
--
-- Replaces the edge function's TWO sequential calls (upsert, then a
-- separate survey_write_log insert) with ONE database transaction:
--
--   • pg_advisory_xact_lock serializes concurrent writes for the same
--     (user_id, week_id) row, so a double-submit can never interleave
--     two partial writes and leave a torn row.
--   • The upsert + audit log commit atomically — a crash in the middle
--     can no longer leave a saved response with no log (or vice-versa).
--   • Column writes go through a static whitelist built from the fixed
--     day/meal lists; payload keys are NEVER interpolated into SQL.
--   • p_request_id makes retries idempotent: if the same request already
--     logged a success (e.g. the response was lost in transit), it is a
--     no-op instead of a double write.
--
-- SECURITY DEFINER so it bypasses client RLS; execution is restricted to
-- the service role (the edge function). Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- request_id column on the audit log for idempotent retries.
ALTER TABLE survey_write_log
  ADD COLUMN IF NOT EXISTS request_id TEXT;
CREATE INDEX IF NOT EXISTS idx_survey_write_log_request
  ON survey_write_log(request_id);

CREATE OR REPLACE FUNCTION public.submit_survey(
  p_user_id uuid,
  p_week_id date,
  p_payload jsonb,
  p_request_id text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days text[] := ARRAY['mon','tue','wed','thu','fri','sat'];
  v_meals text[] := ARRAY['l','d'];
  v_whitelist text[];
  v_present text[] := '{}';
  v_k text;
  v_cols text;
  v_set text;
  v_sql text;
  v_slot_count integer := 0;
  v_action text := 'submit';
  v_update jsonb;
  v_now timestamptz := now();
  v_dedup uuid;
BEGIN
  -- ── 1. Serialize concurrent writes to the same (user, week) row ──
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || '|' || p_week_id::text, 0));

  -- ── 2. Idempotency: a retried request that already logged SUCCESS is a
  -- no-op. The first write may have committed while its HTTP response was
  -- lost (timeout), so the retry must not duplicate the write or the log.
  IF p_request_id IS NOT NULL AND btrim(p_request_id) <> '' THEN
    SELECT id INTO v_dedup
    FROM survey_write_log
    WHERE request_id = p_request_id AND status = 'success'
    ORDER BY created_at DESC
    LIMIT 1;
    IF v_dedup IS NOT NULL THEN
      RETURN jsonb_build_object('ok', true, 'deduped', true, 'week_id', p_week_id, 'slots', 0);
    END IF;
  END IF;

  -- ── 3. Build the column whitelist from the fixed day/meal lists ──
  SELECT array_agg(c) INTO v_whitelist FROM (
    SELECT unnest(ARRAY['thali_number','email','dish_snapshot','edit_metadata']) AS c
    UNION ALL
    SELECT d || '_' || m || '_status' FROM unnest(v_days) AS d, unnest(v_meals) AS m
    UNION ALL
    SELECT d || '_' || m || '_dish_' || i::text
      FROM unnest(v_days) AS d, unnest(v_meals) AS m, generate_series(1, 14) AS i
  ) t(c);

  -- Keep only keys the payload actually provides, are whitelisted, and are
  -- non-null non-empty — never clobber existing data with NULL/''.
  FOREACH v_k IN ARRAY v_whitelist LOOP
    IF p_payload ? v_k AND jsonb_typeof(p_payload->v_k) <> 'null' THEN
      IF jsonb_typeof(p_payload->v_k) = 'string' AND p_payload->>v_k = '' THEN
        CONTINUE;
      END IF;
      v_present := v_present || v_k;
    END IF;
  END LOOP;

  SELECT count(*) INTO v_slot_count FROM unnest(v_present) AS k WHERE k LIKE '%_status';

  -- A write covering all 12 slots = full weekly submission: set submitted_at.
  IF v_slot_count = 12 THEN
    v_present := v_present || ARRAY['submitted_at'];
  END IF;

  v_update := jsonb_build_object('user_id', p_user_id, 'week_id', p_week_id, 'updated_at', v_now)
    || (SELECT COALESCE(jsonb_object_agg(k, p_payload->k), '{}'::jsonb) FROM unnest(v_present) AS k);

  IF v_slot_count = 12 THEN
    v_update := v_update || jsonb_build_object('submitted_at', v_now);
  END IF;
  v_action := CASE WHEN v_slot_count = 0 THEN 'draft' ELSE 'submit' END;

  -- ── 4. Atomic upsert (only whitelisted columns) ──
  IF array_length(v_present, 1) > 0 THEN
    SELECT string_agg(format('%I', k), ', ') INTO v_cols FROM unnest(v_present) AS k;
    SELECT 'updated_at = EXCLUDED.updated_at, ' || string_agg(format('%I = EXCLUDED.%I', k, k), ', ')
      INTO v_set
      FROM unnest(v_present) AS k;
    v_sql := format(
      'INSERT INTO survey_submissions_flat (user_id, week_id, updated_at, %s) ' ||
      'SELECT user_id, week_id, updated_at, %s FROM jsonb_populate_record(NULL::survey_submissions_flat, %L::jsonb) AS r ' ||
      'ON CONFLICT (user_id, week_id) DO UPDATE SET %s',
      v_cols, v_cols, v_update::text, v_set
    );
  ELSE
    v_sql := format(
      'INSERT INTO survey_submissions_flat (user_id, week_id, updated_at) ' ||
      'SELECT user_id, week_id, updated_at FROM jsonb_populate_record(NULL::survey_submissions_flat, %L::jsonb) AS r ' ||
      'ON CONFLICT (user_id, week_id) DO UPDATE SET updated_at = EXCLUDED.updated_at',
      v_update::text
    );
  END IF;
  EXECUTE v_sql;

  -- ── 5. Audit log in the SAME transaction as the write ──
  INSERT INTO survey_write_log (user_id, week_id, action, payload, status, request_id)
  VALUES (p_user_id, p_week_id, v_action, p_payload, 'success', p_request_id);

  RETURN jsonb_build_object('ok', true, 'deduped', false, 'week_id', p_week_id, 'slots', v_slot_count);
END;
$$;

-- Only the edge function (service role) may execute this; members cannot
-- bypass the edge function's auth + validation by calling it directly.
REVOKE ALL ON FUNCTION public.submit_survey(uuid, date, jsonb, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_survey(uuid, date, jsonb, text) TO service_role;
