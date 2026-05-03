-- Fix recursion in staff table RLS policies
-- 1. Create a security definer function to check if a user is an admin
-- This function bypasses RLS because it's SECURITY DEFINER
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

-- 2. Drop existing problematic policies
DROP POLICY IF EXISTS "Anyone can read staff" ON public.staff;
DROP POLICY IF EXISTS "Staff can manage staff" ON public.staff;
DROP POLICY IF EXISTS "Staff insert for admins" ON public.staff;
DROP POLICY IF EXISTS "Staff delete for admins" ON public.staff;

-- 3. Create new, non-recursive policies
-- Anyone can read staff (for the directory)
CREATE POLICY "Anyone can read staff" ON public.staff 
FOR SELECT USING (true);

-- Admins can manage staff (using the security definer function to avoid recursion)
CREATE POLICY "Admins can manage staff" ON public.staff 
FOR ALL USING (public.is_admin());

-- Also fix security on notices (only admins should manage)
DROP POLICY IF EXISTS "Admins can manage notices" ON public.notices;
DROP POLICY IF EXISTS "Admins can delete notices" ON public.notices;

CREATE POLICY "Admins can manage notices" ON public.notices 
FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY "Admins can delete notices" ON public.notices 
FOR DELETE USING (public.is_admin());

-- Also fix khidmat_guzaar (only admins should manage)
DROP POLICY IF EXISTS "Admins can manage khidmat team" ON public.khidmat_guzaar;
CREATE POLICY "Admins can manage khidmat team" ON public.khidmat_guzaar 
FOR ALL USING (public.is_admin());
