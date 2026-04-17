-- =============================================================================
-- AL-MAWAID — COMPLETE SUPABASE SCHEMA
-- Run this ONCE in: Supabase Dashboard → SQL Editor → New Query → Run
-- Safe to re-run: all statements use IF NOT EXISTS / OR REPLACE
-- =============================================================================

-- Required extension (already enabled in most Supabase projects)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Shared helper: auto-update updated_at on any row edit
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- =============================================================================
-- 1. USER_STATS  (member profiles — one row per auth user)
--    Used by: UsersPage, SurveysPage, FeedbackAdminPage, QueriesAdminPage,
--             RequestsAdminPage, Dashboard, KhidmatPortal
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_stats (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  name          TEXT,
  thali_number  INT,
  phone         TEXT,
  address       TEXT,
  city          TEXT,
  avatar_url    TEXT,
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at    TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Auto-update timestamp
DROP TRIGGER IF EXISTS trg_user_stats_updated_at ON public.user_stats;
CREATE TRIGGER trg_user_stats_updated_at
  BEFORE UPDATE ON public.user_stats
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Auto-create a user_stats row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_stats (user_id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_stats_select" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_insert" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_update" ON public.user_stats;
DROP POLICY IF EXISTS "user_stats_delete" ON public.user_stats;

CREATE POLICY "user_stats_select" ON public.user_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "user_stats_insert" ON public.user_stats
  FOR INSERT TO authenticated WITH CHECK (true);

-- Users can update their own row; admins can update any row
CREATE POLICY "user_stats_update" ON public.user_stats
  FOR UPDATE TO authenticated USING (true);

CREATE POLICY "user_stats_delete" ON public.user_stats
  FOR DELETE TO authenticated USING (true);


-- =============================================================================
-- 2. STAFF  (admin, khidmat_guzar, supervisor, cook roles)
--    Used by: App.jsx login role-check, AdminLayout, StaffPage
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.staff (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  email      TEXT,
  phone      TEXT,
  role       TEXT NOT NULL DEFAULT 'khidmat_guzar',
             -- valid: 'admin' | 'khidmat_guzar' | 'supervisor' | 'cook'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS trg_staff_updated_at ON public.staff;
CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON public.staff
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_all" ON public.staff;
CREATE POLICY "staff_all" ON public.staff
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- 3. SURVEY_RESPONSES  (weekly food quantity survey)
--    Used by: SurveysPage, Dashboard
--    Member writes: day, meal, wants_food, dish_responses (jsonb)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.survey_responses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day             TEXT,      -- 'monday' … 'saturday'
  meal            TEXT,      -- 'lunch' | 'dinner'
  wants_food      BOOLEAN DEFAULT true,
  dish_responses  JSONB DEFAULT '{}'::jsonb,
                  -- e.g. {"Roti": 50, "Dal": 100, "Chawal": 25}
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "survey_responses_all" ON public.survey_responses;
CREATE POLICY "survey_responses_all" ON public.survey_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- 4. DAILY_FEEDBACK  (meal star ratings + comment)
--    Used by: FeedbackAdminPage, Dashboard
--    Member writes: day, lunch_stars, dinner_stars, comment
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.daily_feedback (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  day          TEXT,      -- 'monday' … 'saturday'
  lunch_stars  INT CHECK (lunch_stars  BETWEEN 1 AND 5),
  dinner_stars INT CHECK (dinner_stars BETWEEN 1 AND 5),
  comment      TEXT,
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.daily_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "daily_feedback_all" ON public.daily_feedback;
CREATE POLICY "daily_feedback_all" ON public.daily_feedback
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- 5. THALI_REQUESTS  (vacation / stop / change requests from members)
--    Used by: RequestsAdminPage, Dashboard
--    Member writes: request_type, details, date
--    Admin writes: status (pending → approved / rejected)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.thali_requests (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT,   -- e.g. 'vacation', 'stop', 'change', 'resume'
  details      TEXT,
  date         DATE,   -- start date of the request
  status       TEXT DEFAULT 'pending',
               -- 'pending' | 'approved' | 'rejected'
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at   TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS trg_thali_requests_updated_at ON public.thali_requests;
CREATE TRIGGER trg_thali_requests_updated_at
  BEFORE UPDATE ON public.thali_requests
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.thali_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "thali_requests_all" ON public.thali_requests;
CREATE POLICY "thali_requests_all" ON public.thali_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- 6. USER_QUERIES  (help / contact messages from members)
--    Used by: QueriesAdminPage, Dashboard
--    Member writes: subject, message
--    Admin writes: admin_reply, status, replied_at
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_queries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     TEXT,
  message     TEXT,
  status      TEXT DEFAULT 'open',
              -- 'open' | 'resolved' | 'closed'
  admin_reply TEXT,
  replied_at  TIMESTAMP WITH TIME ZONE,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS trg_user_queries_updated_at ON public.user_queries;
CREATE TRIGGER trg_user_queries_updated_at
  BEFORE UPDATE ON public.user_queries
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.user_queries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_queries_all" ON public.user_queries;
CREATE POLICY "user_queries_all" ON public.user_queries
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- 7. APP_SETTINGS  (key-value store for admin-editable config)
--    Used by: SettingsPage
--    Keys: 'weekly_menu' (JSON), 'upi_id', 'upi_amount', 'survey_msg'
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.app_settings (
  id         SERIAL PRIMARY KEY,
  key        TEXT UNIQUE NOT NULL,
  value      TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON public.app_settings;
CREATE TRIGGER trg_app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_settings_select" ON public.app_settings;
DROP POLICY IF EXISTS "app_settings_write"  ON public.app_settings;

CREATE POLICY "app_settings_select" ON public.app_settings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "app_settings_write" ON public.app_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default settings (safe: ON CONFLICT does nothing)
INSERT INTO public.app_settings (key, value) VALUES
  ('upi_id',     'shydrabadwala53@okhdfcbank'),
  ('upi_amount', '400.00'),
  ('survey_msg', 'Survey opens Saturday at 8:00 PM.'),
  ('weekly_menu', '{
    "Monday":    {"lunch":"Chola, Kulcha, Shreekhand, Dal, Chawal","dinner":"FMB Menu"},
    "Tuesday":   {"lunch":"American Choupsey, Wafers, Butter Khichdi","dinner":"Roti, Veg Jaipuri, Chicken Pulao, Soup"},
    "Wednesday": {"lunch":"Vegetable Sandwich, Bhel Salad, Corn Pulao","dinner":"Roti, White Chicken, Manchurian Rice, Gravy"},
    "Thursday":  {"lunch":"Chicken 65, Corn Munch Salad, Dal Makhni, Chawal","dinner":"Roti, Mango Custard, Matar Paneer, Tuwar Pulao, Palidu"},
    "Friday":    {"lunch":"FMB Menu","dinner":"Roti, Gobi Matar, Chicken Kashmiri Pulao, Soup"},
    "Saturday":  {"lunch":"Chana Bateta, Dal Makhni, Chawal","dinner":"Roti, Chicken Tarkari, Veg Coconut Rice, Kung Pao Gravy"}
  }')
ON CONFLICT (key) DO NOTHING;


-- =============================================================================
-- 8. POSTS / ANNOUNCEMENTS  (announcements shown on home screen)
--    Used by: PostPage (member side)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.posts (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      TEXT NOT NULL,
  body       TEXT,
  emoji      TEXT DEFAULT '📌',
  type       TEXT DEFAULT 'announcement',
             -- 'announcement' | 'info' | 'reminder' | 'notice'
  is_urgent  BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "posts_select" ON public.posts;
DROP POLICY IF EXISTS "posts_write"  ON public.posts;

CREATE POLICY "posts_select" ON public.posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "posts_write" ON public.posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- =============================================================================
-- ADMIN USER SETUP
-- After running the schema above, register your admin account here.
--
-- Step 1: Sign up via the app's Member → Sign Up tab using your admin email.
-- Step 2: Confirm the email, then come back here and run ONLY these lines
--         after replacing the placeholders:
-- =============================================================================

-- Find the user_id for your admin email:
-- SELECT id FROM auth.users WHERE email = 'your-admin@email.com';

-- Insert the admin staff record:
-- INSERT INTO public.staff (user_id, name, email, role)
-- VALUES (
--   '<paste-user-id-from-above>',
--   'Admin Name',
--   'your-admin@email.com',
--   'admin'
-- )
-- ON CONFLICT (user_id) DO UPDATE SET role = 'admin';

-- To register a Khidmat Guzar staff member:
-- INSERT INTO public.staff (user_id, name, email, role)
-- VALUES (
--   '<user-id>',
--   'Hussain Bhai',
--   'hussain@email.com',
--   'khidmat_guzar'
-- )
-- ON CONFLICT (user_id) DO NOTHING;
