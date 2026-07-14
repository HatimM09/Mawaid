DROP POLICY IF EXISTS "Anyone can read notices" ON notices;
DROP POLICY IF EXISTS "Admins can insert notices" ON notices;
DROP POLICY IF EXISTS "Admins can update notices" ON notices;
DROP POLICY IF EXISTS "Admins can delete notices" ON notices;

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

CREATE INDEX IF NOT EXISTS idx_notices_type ON notices(type);
CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at DESC);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read notices"
  ON notices FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert notices"
  ON notices FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update notices"
  ON notices FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete notices"
  ON notices FOR DELETE
  USING (public.is_admin());
