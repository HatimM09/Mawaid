-- 1. Weekly Menu Table (New row-per-day structure)
CREATE TABLE IF NOT EXISTS weekly_menu (
    id SERIAL PRIMARY KEY,
    day_name TEXT NOT NULL UNIQUE, -- 'monday', 'tuesday', etc.
    day_ar TEXT,
    lunch TEXT, -- Comma-separated items
    dinner TEXT, -- Comma-separated items
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed Initial Menu Data
INSERT INTO weekly_menu (day_name, day_ar, lunch, dinner) VALUES
('monday', 'الاثنين', 'Chola, Kulcha, Shreekhand, Dal, Chawal', 'FMB Menu'),
('tuesday', 'الثلاثاء', 'Veg Pulao, Raita, Gulab Jamun', 'FMB Menu'),
('wednesday', 'الأربعاء', 'Paneer Butter Masala, Roti, Salad', 'FMB Menu'),
('thursday', 'الخميس', 'Biryani, Mirchi Ka Salan, Curd', 'FMB Menu'),
('friday', 'الجمعة', 'Dal Gosht, Chawal, Sweet', 'FMB Menu'),
('saturday', 'السبت', 'Special Thali, Fruit Custard', 'FMB Menu')
ON CONFLICT (day_name) DO NOTHING;

-- 2. Broadcast Notices Table
CREATE TABLE IF NOT EXISTS notices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    sender_name TEXT DEFAULT 'Admin Office',
    media TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    target_user_id UUID REFERENCES auth.users(id), -- NULL for broadcast to all
    tone TEXT DEFAULT '#D4AF37',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable Realtime for Notices (Run this in the SQL Editor)
-- ALTER PUBLICATION supabase_realtime ADD TABLE notices;

-- 3. Inventory Tables
CREATE TABLE IF NOT EXISTS inventory (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    category_id INT,
    stock DECIMAL DEFAULT 0,
    unit TEXT DEFAULT 'kg',
    low_stock_threshold DECIMAL DEFAULT 10,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_log (
    id SERIAL PRIMARY KEY,
    product_id INT REFERENCES inventory(id) ON DELETE CASCADE,
    product_name TEXT,
    type TEXT, -- 'in', 'out'
    qty DECIMAL,
    new_stock DECIMAL,
    note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Staff & Roles
CREATE TABLE IF NOT EXISTS staff (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    name TEXT,
    email TEXT UNIQUE,
    role TEXT, -- 'admin', 'khidmat', 'inventory_manager', 'supervisor'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. User Profiles & Stats
CREATE TABLE IF NOT EXISTS user_stats (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    name TEXT,
    thali_number TEXT UNIQUE,
    avatar_url TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. Daily Feedback
CREATE TABLE IF NOT EXISTS daily_feedback (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    day TEXT, -- 'monday', 'tuesday', etc.
    lunch_stars INT,
    lunch_emoji TEXT,
    dinner_stars INT,
    dinner_emoji TEXT,
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, day)
);

-- 7. Thali Requests
CREATE TABLE IF NOT EXISTS thali_requests (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    request_type TEXT, -- 'stop', 'resume', 'extra'
    from_date DATE,
    to_date DATE,
    extra_items JSONB, -- For extra food requests
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Payments
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id),
    order_id TEXT UNIQUE,
    amount DECIMAL,
    status TEXT, -- 'success', 'pending', 'failed'
    method TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. Weekly Surveys (Flat submission structure matching App.jsx logic)
CREATE TABLE IF NOT EXISTS survey_submissions_flat (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE,
    thali_no TEXT,
    email TEXT,
    
    -- Monday
    mon_l_status TEXT, mon_l_dish_1 TEXT, mon_l_dish_2 TEXT, mon_l_dish_3 TEXT, mon_l_dish_4 TEXT,
    mon_d_status TEXT, mon_d_dish_1 TEXT, mon_d_dish_2 TEXT, mon_d_dish_3 TEXT, mon_d_dish_4 TEXT,
    
    -- Tuesday
    tue_l_status TEXT, tue_l_dish_1 TEXT, tue_l_dish_2 TEXT, tue_l_dish_3 TEXT, tue_l_dish_4 TEXT,
    tue_d_status TEXT, tue_d_dish_1 TEXT, tue_d_dish_2 TEXT, tue_d_dish_3 TEXT, tue_d_dish_4 TEXT,
    
    -- Wednesday
    wed_l_status TEXT, wed_l_dish_1 TEXT, wed_l_dish_2 TEXT, wed_l_dish_3 TEXT, wed_l_dish_4 TEXT,
    wed_d_status TEXT, wed_d_dish_1 TEXT, wed_d_dish_2 TEXT, wed_d_dish_3 TEXT, wed_d_dish_4 TEXT,
    
    -- Thursday
    thu_l_status TEXT, thu_l_dish_1 TEXT, thu_l_dish_2 TEXT, thu_l_dish_3 TEXT, thu_l_dish_4 TEXT,
    thu_d_status TEXT, thu_d_dish_1 TEXT, thu_d_dish_2 TEXT, thu_d_dish_3 TEXT, thu_d_dish_4 TEXT,
    
    -- Friday
    fri_l_status TEXT, fri_l_dish_1 TEXT, fri_l_dish_2 TEXT, fri_l_dish_3 TEXT, fri_l_dish_4 TEXT,
    fri_d_status TEXT, fri_d_dish_1 TEXT, fri_d_dish_2 TEXT, fri_d_dish_3 TEXT, fri_d_dish_4 TEXT,
    
    -- Saturday
    sat_l_status TEXT, sat_l_dish_1 TEXT, sat_l_dish_2 TEXT, sat_l_dish_3 TEXT, sat_l_dish_4 TEXT,
    sat_d_status TEXT, sat_d_dish_1 TEXT, sat_d_dish_2 TEXT, sat_d_dish_3 TEXT, sat_d_dish_4 TEXT,
    
    edit_metadata JSONB DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. Enable Basic Access Policies (Run these if RLS is enabled)
ALTER TABLE weekly_menu ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read" ON weekly_menu;
CREATE POLICY "Public Read" ON weekly_menu FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All" ON weekly_menu;
CREATE POLICY "Admin All" ON weekly_menu FOR ALL USING (true);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public Read Notices" ON notices;
CREATE POLICY "Public Read Notices" ON notices FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin All Notices" ON notices;
CREATE POLICY "Admin All Notices" ON notices FOR ALL USING (true);
