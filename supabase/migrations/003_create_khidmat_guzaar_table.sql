DROP POLICY IF EXISTS "Anyone can read khidmat guzaar" ON khidmat_guzaar;
DROP POLICY IF EXISTS "Admins can manage khidmat guzaar" ON khidmat_guzaar;
DROP POLICY IF EXISTS "Admins can update khidmat guzaar" ON khidmat_guzaar;
DROP POLICY IF EXISTS "Admins can delete khidmat guzaar" ON khidmat_guzaar;

CREATE TABLE IF NOT EXISTS khidmat_guzaar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'khidmat_guzar',
  phone TEXT,
  email TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE khidmat_guzaar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read khidmat guzaar"
  ON khidmat_guzaar FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage khidmat guzaar"
  ON khidmat_guzaar FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update khidmat guzaar"
  ON khidmat_guzaar FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete khidmat guzaar"
  ON khidmat_guzaar FOR DELETE
  USING (public.is_admin());
