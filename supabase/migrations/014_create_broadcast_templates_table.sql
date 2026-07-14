DROP POLICY IF EXISTS "Admins can read templates" ON broadcast_templates;
DROP POLICY IF EXISTS "Admins can insert templates" ON broadcast_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON broadcast_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON broadcast_templates;

CREATE TABLE IF NOT EXISTS broadcast_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  sender_name TEXT DEFAULT 'Admin',
  tone TEXT,
  media_url TEXT,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific', 'admins', 'opt_in', 'opt_out')),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE broadcast_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read templates"
  ON broadcast_templates FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert templates"
  ON broadcast_templates FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update templates"
  ON broadcast_templates FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete templates"
  ON broadcast_templates FOR DELETE
  USING (public.is_admin());
