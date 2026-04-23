-- Al-Mawaid Full SQL Schema
-- Generated on: 2024-04-21
-- Target: Supabase / PostgreSQL

-- 1. USER PROFILES & STATS
CREATE TABLE IF NOT EXISTS public.user_stats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    thali_number TEXT,
    phone TEXT,
    address TEXT,
    city TEXT,
    avatar_url TEXT,
    surveys_completed INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. STAFF & PERMISSIONS
CREATE TABLE IF NOT EXISTS public.staff (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'khidmat_guzar', -- admin, khidmat_guzar, supervisor, cook
    phone TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. WEEKLY MENU CONFIGURATION
CREATE TABLE IF NOT EXISTS public.weekly_menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    week_start DATE UNIQUE NOT NULL,
    menu_json JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SURVEY SUBMISSIONS FLAT (The Primary Survey Table)
-- One row per user per week/cycle. Flat columns for kitchen exports.
CREATE TABLE IF NOT EXISTS public.survey_submissions_flat (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    thali_no TEXT,
    email TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    edit_metadata JSONB DEFAULT '{}'::jsonb, -- Stores edit counts for each day/meal e.g. {"mon_l": 1, "tue_d": 0}
    
    -- Monday
    mon_l_status TEXT, mon_l_dish_1 TEXT, mon_l_dish_2 TEXT, mon_l_dish_3 TEXT,
    mon_d_status TEXT, mon_d_dish_1 TEXT, mon_d_dish_2 TEXT, mon_d_dish_3 TEXT,
    
    -- Tuesday
    tue_l_status TEXT, tue_l_dish_1 TEXT, tue_l_dish_2 TEXT, tue_l_dish_3 TEXT,
    tue_d_status TEXT, tue_d_dish_1 TEXT, tue_d_dish_2 TEXT, tue_d_dish_3 TEXT,
    
    -- Wednesday
    wed_l_status TEXT, wed_l_dish_1 TEXT, wed_l_dish_2 TEXT, wed_l_dish_3 TEXT,
    wed_d_status TEXT, wed_d_dish_1 TEXT, wed_d_dish_2 TEXT, wed_d_dish_3 TEXT,
    
    -- Thursday
    thu_l_status TEXT, thu_l_dish_1 TEXT, thu_l_dish_2 TEXT, thu_l_dish_3 TEXT,
    thu_d_status TEXT, thu_d_dish_1 TEXT, thu_d_dish_2 TEXT, thu_d_dish_3 TEXT,
    
    -- Friday
    fri_l_status TEXT, fri_l_dish_1 TEXT, fri_l_dish_2 TEXT, fri_l_dish_3 TEXT,
    fri_d_status TEXT, fri_d_dish_1 TEXT, fri_d_dish_2 TEXT, fri_d_dish_3 TEXT,
    
    -- Saturday
    sat_l_status TEXT, sat_l_dish_1 TEXT, sat_l_dish_2 TEXT, sat_l_dish_3 TEXT,
    sat_d_status TEXT, sat_d_dish_1 TEXT, sat_d_dish_2 TEXT, sat_d_dish_3 TEXT
);

-- 6. THALI REQUESTS (Change Requests, Guest Requests, etc.)
CREATE TABLE IF NOT EXISTS public.thali_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    request_type TEXT NOT NULL, -- Extra Thali, Stop Thali, Change Address, etc.
    details TEXT,
    date DATE,
    status TEXT DEFAULT 'pending', -- pending, approved, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. USER QUERIES & SUPPORT
CREATE TABLE IF NOT EXISTS public.queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    subject TEXT,
    comment TEXT NOT NULL,
    status TEXT DEFAULT 'open', -- open, resolved, closed
    admin_reply TEXT,
    replied_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. DAILY FEEDBACK
CREATE TABLE IF NOT EXISTS public.daily_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    day TEXT NOT NULL,
    lunch_stars INTEGER CHECK (lunch_stars BETWEEN 1 AND 5),
    dinner_stars INTEGER CHECK (dinner_stars BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. PAYMENTS (Subscription/Contribution)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    order_id TEXT UNIQUE NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    method TEXT,
    status TEXT NOT NULL, -- success, failed, pending
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. KITCHEN INVENTORY
CREATE TABLE IF NOT EXISTS public.inventory (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category_id INTEGER,
    stock DECIMAL(12, 2) DEFAULT 0,
    unit TEXT DEFAULT 'kg',
    low_stock_threshold DECIMAL(12, 2) DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER REFERENCES public.inventory(id) ON DELETE CASCADE,
    product_name TEXT,
    type TEXT NOT NULL, -- in, out
    qty DECIMAL(12, 2) NOT NULL,
    new_stock DECIMAL(12, 2) NOT NULL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. APP SETTINGS (Global Config)
CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════
-- FUNCTIONS & RPCs
-- ══════════════════════════════════════════════════════════════

-- Increment user survey count
CREATE OR REPLACE FUNCTION public.increment_user_surveys(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_stats
    SET surveys_completed = surveys_completed + 1
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ══════════════════════════════════════════════════════════════
-- RLS POLICIES (Row Level Security)
-- ══════════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_submissions_flat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thali_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Member access (Self-service)
CREATE POLICY "Users can view/update own stats" ON public.user_stats
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own flat submissions" ON public.survey_submissions_flat
    FOR ALL USING (auth.uid() = user_id);

-- Users can read their own submissions (select only)
CREATE POLICY "Users can read own submissions" ON public.survey_submissions_flat
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own requests" ON public.thali_requests
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own queries" ON public.queries
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own feedback" ON public.daily_feedback
    FOR ALL USING (auth.uid() = user_id);

-- Admin & Staff access Helper Functions
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.staff 
        WHERE user_id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.staff 
        WHERE user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Admin/Staff Policies
CREATE POLICY "Staff can view all user stats" ON public.user_stats FOR SELECT USING (public.is_staff());
CREATE POLICY "Admin can manage all user stats" ON public.user_stats FOR ALL USING (public.is_admin());

CREATE POLICY "Users can view own staff record" ON public.staff FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admin full access on staff" ON public.staff FOR ALL USING (public.is_admin());
CREATE POLICY "Admin can manage flat submissions" ON public.survey_submissions_flat FOR ALL USING (public.is_admin());

CREATE POLICY "Staff can manage inventory" ON public.inventory FOR ALL USING (public.is_staff());
CREATE POLICY "Staff can manage inventory logs" ON public.inventory_log FOR ALL USING (public.is_staff());

CREATE POLICY "Staff can manage queries" ON public.queries FOR ALL USING (public.is_staff());
CREATE POLICY "Staff can manage requests" ON public.thali_requests FOR ALL USING (public.is_staff());

CREATE POLICY "Anyone can view app settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admin can manage app settings" ON public.app_settings FOR ALL USING (public.is_admin());
