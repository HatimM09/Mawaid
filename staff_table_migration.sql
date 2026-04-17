-- =========================================================================
-- AL-MAWAID: STAFF TABLE MIGRATION
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard → SQL Editor → New Query → Paste → Run
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.staff (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    email       VARCHAR(255),
    phone       VARCHAR(50),
    role        VARCHAR(50) NOT NULL DEFAULT 'khidmat_guzar',
                -- valid roles: 'admin' | 'khidmat_guzar' | 'supervisor' | 'cook'
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id)
);

-- Auto-update timestamp on edit
CREATE OR REPLACE TRIGGER update_staff_updated_at
BEFORE UPDATE ON public.staff
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read staff
CREATE POLICY "Allow authenticated read" ON public.staff
    FOR SELECT TO authenticated USING (true);

-- Only admins (service role) can insert/update/delete
-- For the StaffPage in the admin portal to work, you can temporarily
-- allow all authenticated inserts, or use Supabase service role key.
CREATE POLICY "Allow authenticated write" ON public.staff
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =========================================================================
-- AFTER CREATING THE TABLE:
-- Insert your admin user so they can log in via the Admin tab.
-- Replace the email below with your actual admin's email address.
-- =========================================================================

-- Step 1: Find your admin's user_id
-- SELECT id FROM auth.users WHERE email = 'your-admin@email.com';

-- Step 2: Insert them as admin staff  (replace the UUID and name)
-- INSERT INTO public.staff (user_id, name, email, role)
-- VALUES (
--   '<paste-user-id-from-step-1>',
--   'Admin Name',
--   'your-admin@email.com',
--   'admin'
-- );
