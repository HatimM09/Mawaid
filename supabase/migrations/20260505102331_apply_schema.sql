-- ============================================================
-- DANGER: THIS WILL DELETE ALL DATA AND TABLES IN THE PUBLIC SCHEMA
-- ============================================================

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

-- ============================================================
-- AL-MAWAID COMPLETE SUPABASE SCHEMA (CLEANED)
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- This creates all tables, RLS policies, storage buckets,
-- and seed data needed for the full app to work.
-- NOTE: Push Notifications and Edge Functions have been removed.
-- ============================================================

-- ════════════════════════════════════════════════════════════
-- 1. USER STATS (Member profiles synced from auth)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.user_stats (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT DEFAULT '',
  email       TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  address     TEXT DEFAULT '',
  thali_number TEXT DEFAULT '',
  avatar_url  TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Auto-create user_stats row when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════════════════════════
-- 2. STAFF (Admin, Khidmat Guzar, Inventory Manager roles)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.staff (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'khidmat_guzar'
              CHECK (role IN ('admin', 'khidmat_guzar', 'supervisor', 'inventory_manager')),
  area        TEXT DEFAULT '',
  avatar_url  TEXT DEFAULT '',
  sort_order  INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 3. KHIDMAT GUZAAR (Public-facing service team directory)
-- ════════════════════════════════════════════════════════════
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

-- ════════════════════════════════════════════════════════════
-- 4. WEEKLY MENU
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.weekly_menu (
  id          BIGSERIAL PRIMARY KEY,
  week_start  DATE DEFAULT CURRENT_DATE,
  day_name    TEXT NOT NULL UNIQUE
              CHECK (day_name IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday')),
  day_ar      TEXT DEFAULT '',
  lunch       TEXT DEFAULT '',
  dinner      TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 5. SURVEY SUBMISSIONS (Flat/wide table for weekly surveys)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.survey_submissions_flat (
  id              BIGSERIAL PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.user_stats(user_id) ON DELETE CASCADE,
  week_id         TEXT DEFAULT '',
  thali_number    TEXT DEFAULT '',
  email           TEXT DEFAULT '',

  -- Monday
  mon_l_status    TEXT DEFAULT NULL,
  mon_l_dish_1    TEXT DEFAULT NULL,
  mon_l_dish_2    TEXT DEFAULT NULL,
  mon_l_dish_3    TEXT DEFAULT NULL,
  mon_l_dish_4    TEXT DEFAULT NULL,
  mon_l_dish_5    TEXT DEFAULT NULL,
  mon_d_status    TEXT DEFAULT NULL,
  mon_d_dish_1    TEXT DEFAULT NULL,
  mon_d_dish_2    TEXT DEFAULT NULL,
  mon_d_dish_3    TEXT DEFAULT NULL,
  mon_d_dish_4    TEXT DEFAULT NULL,
  mon_d_dish_5    TEXT DEFAULT NULL,

  -- Tuesday
  tue_l_status    TEXT DEFAULT NULL,
  tue_l_dish_1    TEXT DEFAULT NULL,
  tue_l_dish_2    TEXT DEFAULT NULL,
  tue_l_dish_3    TEXT DEFAULT NULL,
  tue_l_dish_4    TEXT DEFAULT NULL,
  tue_l_dish_5    TEXT DEFAULT NULL,
  tue_d_status    TEXT DEFAULT NULL,
  tue_d_dish_1    TEXT DEFAULT NULL,
  tue_d_dish_2    TEXT DEFAULT NULL,
  tue_d_dish_3    TEXT DEFAULT NULL,
  tue_d_dish_4    TEXT DEFAULT NULL,
  tue_d_dish_5    TEXT DEFAULT NULL,

  -- Wednesday
  wed_l_status    TEXT DEFAULT NULL,
  wed_l_dish_1    TEXT DEFAULT NULL,
  wed_l_dish_2    TEXT DEFAULT NULL,
  wed_l_dish_3    TEXT DEFAULT NULL,
  wed_l_dish_4    TEXT DEFAULT NULL,
  wed_l_dish_5    TEXT DEFAULT NULL,
  wed_d_status    TEXT DEFAULT NULL,
  wed_d_dish_1    TEXT DEFAULT NULL,
  wed_d_dish_2    TEXT DEFAULT NULL,
  wed_d_dish_3    TEXT DEFAULT NULL,
  wed_d_dish_4    TEXT DEFAULT NULL,
  wed_d_dish_5    TEXT DEFAULT NULL,

  -- Thursday
  thu_l_status    TEXT DEFAULT NULL,
  thu_l_dish_1    TEXT DEFAULT NULL,
  thu_l_dish_2    TEXT DEFAULT NULL,
  thu_l_dish_3    TEXT DEFAULT NULL,
  thu_l_dish_4    TEXT DEFAULT NULL,
  thu_l_dish_5    TEXT DEFAULT NULL,
  thu_d_status    TEXT DEFAULT NULL,
  thu_d_dish_1    TEXT DEFAULT NULL,
  thu_d_dish_2    TEXT DEFAULT NULL,
  thu_d_dish_3    TEXT DEFAULT NULL,
  thu_d_dish_4    TEXT DEFAULT NULL,
  thu_d_dish_5    TEXT DEFAULT NULL,

  -- Friday
  fri_l_status    TEXT DEFAULT NULL,
  fri_l_dish_1    TEXT DEFAULT NULL,
  fri_l_dish_2    TEXT DEFAULT NULL,
  fri_l_dish_3    TEXT DEFAULT NULL,
  fri_l_dish_4    TEXT DEFAULT NULL,
  fri_l_dish_5    TEXT DEFAULT NULL,
  fri_d_status    TEXT DEFAULT NULL,
  fri_d_dish_1    TEXT DEFAULT NULL,
  fri_d_dish_2    TEXT DEFAULT NULL,
  fri_d_dish_3    TEXT DEFAULT NULL,
  fri_d_dish_4    TEXT DEFAULT NULL,
  fri_d_dish_5    TEXT DEFAULT NULL,

  -- Saturday
  sat_l_status    TEXT DEFAULT NULL,
  sat_l_dish_1    TEXT DEFAULT NULL,
  sat_l_dish_2    TEXT DEFAULT NULL,
  sat_l_dish_3    TEXT DEFAULT NULL,
  sat_l_dish_4    TEXT DEFAULT NULL,
  sat_l_dish_5    TEXT DEFAULT NULL,
  sat_d_status    TEXT DEFAULT NULL,
  sat_d_dish_1    TEXT DEFAULT NULL,
  sat_d_dish_2    TEXT DEFAULT NULL,
  sat_d_dish_3    TEXT DEFAULT NULL,
  sat_d_dish_4    TEXT DEFAULT NULL,
  sat_d_dish_5    TEXT DEFAULT NULL,

  -- Edit tracking
  edit_metadata   JSONB DEFAULT '{}',

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id)
);

-- ════════════════════════════════════════════════════════════
-- 6. DAILY FEEDBACK (Star ratings for lunch/dinner)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.daily_feedback (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day           TEXT NOT NULL,  -- e.g. 'monday', 'tuesday'
  lunch_stars   INT DEFAULT NULL CHECK (lunch_stars IS NULL OR (lunch_stars >= 1 AND lunch_stars <= 5)),
  lunch_emoji   TEXT DEFAULT NULL,
  dinner_stars  INT DEFAULT NULL CHECK (dinner_stars IS NULL OR (dinner_stars >= 1 AND dinner_stars <= 5)),
  dinner_emoji  TEXT DEFAULT NULL,
  comment       TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now(),

  UNIQUE(user_id, day)
);

-- ════════════════════════════════════════════════════════════
-- 7. THALI REQUESTS (Resume, Stop, Extra food requests)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.thali_requests (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type  TEXT NOT NULL CHECK (request_type IN ('resume', 'stop', 'extra')),
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  from_date     DATE DEFAULT NULL,
  to_date       DATE DEFAULT NULL,
  extra_items   JSONB DEFAULT NULL,
  admin_note    TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 8. QUERIES (User queries with media attachments)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.queries (
  id            BIGSERIAL PRIMARY KEY,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment       TEXT DEFAULT '',
  media         JSONB DEFAULT '[]',
  status        TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'in_progress')),
  admin_reply   TEXT DEFAULT NULL,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 9. NOTICES (Admin broadcasts & targeted notifications)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.notices (
  id              BIGSERIAL PRIMARY KEY,
  title           TEXT NOT NULL DEFAULT '',
  body            TEXT DEFAULT '',
  tone            TEXT DEFAULT NULL,  -- accent color hint
  sender_name     TEXT DEFAULT 'Admin',
  target_user_id  UUID DEFAULT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media           JSONB DEFAULT '[]',
  scheduled_at    TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 10. INVENTORY (Kitchen stock management)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inventory (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL DEFAULT '',
  category_id INT DEFAULT NULL,
  stock       NUMERIC DEFAULT 0,
  unit        TEXT DEFAULT 'kg',
  low_stock   NUMERIC DEFAULT 5,
  category    TEXT DEFAULT 'General',
  image_url   TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 11. INVENTORY LOG (Audit trail for stock changes)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.inventory_log (
  id            BIGSERIAL PRIMARY KEY,
  item_id       BIGINT REFERENCES public.inventory(id) ON DELETE CASCADE,
  item_name     TEXT DEFAULT '',
  action        TEXT DEFAULT '',  -- 'add', 'remove', 'set'
  quantity      NUMERIC DEFAULT 0,
  old_stock     NUMERIC DEFAULT 0,
  new_stock     NUMERIC DEFAULT 0,
  performed_by  TEXT DEFAULT '',
  notes         TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ════════════════════════════════════════════════════════════
-- 12. APP SETTINGS (Key-value config store)
-- ════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.app_settings (
  id          BIGSERIAL PRIMARY KEY,
  key         TEXT NOT NULL UNIQUE,
  value       TEXT DEFAULT '',
  updated_at  TIMESTAMPTZ DEFAULT now()
);


-- ════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ════════════════════════════════════════════════════════════

-- Security Definer function to check admin status without recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.staff
    WHERE user_id = auth.uid()
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.khidmat_guzaar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_submissions_flat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thali_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ── user_stats ──
CREATE POLICY "Users can read all profiles" ON public.user_stats FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert profiles" ON public.user_stats FOR INSERT WITH CHECK (true);

-- ── staff ──
CREATE POLICY "Anyone can read staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Staff can manage staff" ON public.staff FOR ALL USING (public.is_admin());
CREATE POLICY "Staff insert for admins" ON public.staff FOR INSERT WITH CHECK (true);
CREATE POLICY "Staff delete for admins" ON public.staff FOR DELETE USING (true);

-- ── khidmat_guzaar ──
CREATE POLICY "Anyone can read khidmat team" ON public.khidmat_guzaar FOR SELECT USING (true);
CREATE POLICY "Admins can manage khidmat team" ON public.khidmat_guzaar FOR ALL USING (public.is_admin());

-- ── weekly_menu ──
CREATE POLICY "Anyone can read menu" ON public.weekly_menu FOR SELECT USING (true);
CREATE POLICY "Admins can manage menu" ON public.weekly_menu FOR ALL USING (true);

-- ── survey_submissions_flat ──
CREATE POLICY "Users can read all surveys" ON public.survey_submissions_flat FOR SELECT USING (true);
CREATE POLICY "Users can upsert own survey" ON public.survey_submissions_flat FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own survey" ON public.survey_submissions_flat FOR UPDATE USING (auth.uid() = user_id);

-- ── daily_feedback ──
CREATE POLICY "Users can read all feedback" ON public.daily_feedback FOR SELECT USING (true);
CREATE POLICY "Users can upsert own feedback" ON public.daily_feedback FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own feedback" ON public.daily_feedback FOR UPDATE USING (auth.uid() = user_id);

-- ── thali_requests ──
CREATE POLICY "Users can read all requests" ON public.thali_requests FOR SELECT USING (true);
CREATE POLICY "Users can insert own requests" ON public.thali_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update requests" ON public.thali_requests FOR UPDATE USING (true);

-- ── queries ──
CREATE POLICY "Users can read all queries" ON public.queries FOR SELECT USING (true);
CREATE POLICY "Users can insert own queries" ON public.queries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can update queries" ON public.queries FOR UPDATE USING (true);

-- ── notices ──
CREATE POLICY "Users can read notices" ON public.notices FOR SELECT USING (true);
CREATE POLICY "Admins can manage notices" ON public.notices FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can delete notices" ON public.notices FOR DELETE USING (true);

-- ── inventory ──
CREATE POLICY "Anyone can read inventory" ON public.inventory FOR SELECT USING (true);
CREATE POLICY "Staff can manage inventory" ON public.inventory FOR ALL USING (true);

-- ── inventory_log ──
CREATE POLICY "Anyone can read inventory log" ON public.inventory_log FOR SELECT USING (true);
CREATE POLICY "Staff can insert inventory log" ON public.inventory_log FOR INSERT WITH CHECK (true);

-- ── app_settings ──
CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage settings" ON public.app_settings FOR ALL USING (true);


-- ════════════════════════════════════════════════════════════
-- REALTIME (Enable for live updates)
-- ════════════════════════════════════════════════════════════
-- Go to Supabase Dashboard > Database > Replication and enable
-- the following tables for realtime:
--   - notices
--   - inventory
--   - inventory_log
--   - survey_submissions_flat
--
-- Or run (requires superuser):
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notices;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_log;


-- ════════════════════════════════════════════════════════════
-- STORAGE BUCKET (For query media uploads)
-- ════════════════════════════════════════════════════════════
-- Create via Supabase Dashboard > Storage > New Bucket:
--   Name: query-media
--   Public: YES (so images render in the UI)
--
-- Then add this policy in SQL:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('query-media', 'query-media', true)
-- ON CONFLICT (id) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- SEED DATA: Default weekly menu
-- ════════════════════════════════════════════════════════════
INSERT INTO public.weekly_menu (day_name, lunch, dinner) VALUES
  ('Monday',    'Chola, Kulcha, Shreekhand, Dal, Chawal', 'FMB Menu'),
  ('Tuesday',   'American Choupsey, Wafers, Butter Khichdi', 'Roti, Veg Jaipuri, Chicken Pulao, Soup'),
  ('Wednesday', 'Vegetable Sandwich, Bhel Salad, Corn Pulao', 'Roti, White Chicken, Manchurian Rice, Gravy'),
  ('Thursday',  'Chicken 65, Corn Munch Salad, Dal Makhni, Chawal', 'Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu'),
  ('Friday',    'FMB Menu', 'Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup'),
  ('Saturday',  'Chana Bateta, Dal Makhni, Chawal', 'Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy')
ON CONFLICT (day_name) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- SEED DATA: Default app settings
-- ════════════════════════════════════════════════════════════
INSERT INTO public.app_settings (key, value) VALUES
  ('upi_id', 'shydrabadwala53@okhdfcbank'),
  ('upi_amount', '400.00'),
  ('survey_msg', 'Survey opens Saturday at 8:00 PM and closes Monday at 10:00 AM.')
ON CONFLICT (key) DO NOTHING;

-- ════════════════════════════════════════════════════════════
-- DONE! Your Al-Mawaid database is ready.
-- ════════════════════════════════════════════════════════════
