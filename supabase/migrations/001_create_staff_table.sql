-- Supabase Auth Migration: Staff table & RLS
-- Run this in your Supabase project SQL editor

-- Staff table (roles & permissions)
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

-- Index for fast user_id lookups
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON staff(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_email ON staff(email);
CREATE INDEX IF NOT EXISTS idx_staff_role ON staff(role);

-- Enable Row Level Security
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own staff record
CREATE POLICY "Users can read own staff record"
  ON staff FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Admins can read all staff records
CREATE POLICY "Admins can read all staff"
  ON staff FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policy: Admins can insert staff records
CREATE POLICY "Admins can insert staff"
  ON staff FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policy: Admins can update staff records
CREATE POLICY "Admins can update staff"
  ON staff FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Policy: Admins can delete staff records
CREATE POLICY "Admins can delete staff"
  ON staff FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM staff WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Bootstrap: Allow first admin creation via anon if staff table is empty
-- Remove this after first admin is created
CREATE POLICY "Allow first admin bootstrap"
  ON staff FOR INSERT
  WITH CHECK (
    NOT EXISTS (SELECT 1 FROM staff)
    AND role = 'admin'
  );

-- Auto-update updated_at on row modification
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_staff_updated_at
  BEFORE UPDATE ON staff
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
