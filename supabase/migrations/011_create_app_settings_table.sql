DROP POLICY IF EXISTS "Anyone can read app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can insert app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can update app settings" ON app_settings;
DROP POLICY IF EXISTS "Admins can delete app settings" ON app_settings;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read app settings"
  ON app_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert app settings"
  ON app_settings FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update app settings"
  ON app_settings FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete app settings"
  ON app_settings FOR DELETE
  USING (public.is_admin());
