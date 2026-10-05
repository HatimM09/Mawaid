-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Migration 052: Create Payments & Tracking Table
-- Supports Google Pay / UPI Payments & User Portal Tracking
-- Full Management for Mulla Murtaza Mohammadhussain Hamid
-- ═══════════════════════════════════════════════════════════════

-- Helper function to identify Payment Managers (including Mulla Murtaza Hamid & admins)
CREATE OR REPLACE FUNCTION public.is_payment_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.is_admin() OR EXISTS (
    SELECT 1 FROM public.user_stats 
    WHERE user_id = auth.uid() 
    AND (
      role IN ('admin', 'supervisor', 'payment_manager', 'khidmat_guzar')
      OR name ILIKE '%Murtaza%Hamid%'
      OR name ILIKE '%Mulla Murtaza%'
      OR email ILIKE '%murtaza%'
    )
  );
$$;

-- Add payment_exempt & custom_due_amount columns to user_stats if not present
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS payment_exempt BOOLEAN DEFAULT false;
ALTER TABLE public.user_stats ADD COLUMN IF NOT EXISTS custom_due_amount NUMERIC(10, 2);

CREATE TABLE IF NOT EXISTS public.user_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT DEFAULT '',
  user_email TEXT DEFAULT '',
  thali_number TEXT DEFAULT '',
  amount NUMERIC(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('initiated', 'submitted', 'verified', 'rejected')),
  transaction_ref TEXT,
  upi_id TEXT DEFAULT 'murtazacool558@okhdfcbank',
  payee_name TEXT DEFAULT 'Al-Mawaid',
  payment_method TEXT DEFAULT 'Google Pay',
  note TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_user_payments_user_id ON public.user_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_payments_thali ON public.user_payments(thali_number);
CREATE INDEX IF NOT EXISTS idx_user_payments_created_at ON public.user_payments(created_at DESC);

-- Enable RLS
ALTER TABLE public.user_payments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can read own payments" ON public.user_payments;
DROP POLICY IF EXISTS "Users can insert own payments" ON public.user_payments;
DROP POLICY IF EXISTS "Users can update own payments" ON public.user_payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.user_payments;
DROP POLICY IF EXISTS "Payment managers can manage all payments" ON public.user_payments;
DROP POLICY IF EXISTS "Users and managers can read payments" ON public.user_payments;
DROP POLICY IF EXISTS "Users and managers can insert payments" ON public.user_payments;
DROP POLICY IF EXISTS "Users and managers can update payments" ON public.user_payments;
DROP POLICY IF EXISTS "Managers can delete payments" ON public.user_payments;

-- RLS: Users can read their own payments, Managers can read all
CREATE POLICY "Users and managers can read payments"
  ON public.user_payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_payment_manager());

-- RLS: Users can log their own payments, Managers can insert for any user
CREATE POLICY "Users and managers can insert payments"
  ON public.user_payments FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_payment_manager());

-- RLS: Users can update their own payments, Managers can update/verify any payment
CREATE POLICY "Users and managers can update payments"
  ON public.user_payments FOR UPDATE
  USING (auth.uid() = user_id OR public.is_payment_manager());

-- RLS: Managers can delete invalid payments if necessary
CREATE POLICY "Managers can delete payments"
  ON public.user_payments FOR DELETE
  USING (public.is_payment_manager());

-- Grant payment manager permission to view and update user_stats (for payment_exempt & dues)
DROP POLICY IF EXISTS "Payment managers can read user stats" ON public.user_stats;
CREATE POLICY "Payment managers can read user stats"
  ON public.user_stats FOR SELECT
  USING (public.is_payment_manager());

DROP POLICY IF EXISTS "Payment managers can update user stats" ON public.user_stats;
CREATE POLICY "Payment managers can update user stats"
  ON public.user_stats FOR UPDATE
  USING (public.is_payment_manager());

-- Grant payment manager permission to manage app_settings (due amount, UPI ID, titles, visibility)
DROP POLICY IF EXISTS "Payment managers can insert app settings" ON public.app_settings;
CREATE POLICY "Payment managers can insert app settings"
  ON public.app_settings FOR INSERT
  WITH CHECK (public.is_payment_manager());

DROP POLICY IF EXISTS "Payment managers can update app settings" ON public.app_settings;
CREATE POLICY "Payment managers can update app settings"
  ON public.app_settings FOR UPDATE
  USING (public.is_payment_manager());

-- Insert default app_settings for UPI and Payment Dues if not set
INSERT INTO public.app_settings (key, value)
VALUES 
  ('upi_id', 'murtazacool558@okhdfcbank'),
  ('upi_payee_name', 'Al-Mawaid'),
  ('default_payment_due', '1500'),
  ('payment_title', 'Monthly Thali Contribution'),
  ('payment_enabled', 'true'),
  ('payment_manager_name', 'Mulla Murtaza Mohammadhussain hamid')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
