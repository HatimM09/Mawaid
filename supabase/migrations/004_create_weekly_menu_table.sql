DROP POLICY IF EXISTS "Anyone can read weekly menu" ON weekly_menu;
DROP POLICY IF EXISTS "Admins can manage weekly menu" ON weekly_menu;
DROP POLICY IF EXISTS "Admins can update weekly menu" ON weekly_menu;
DROP POLICY IF EXISTS "Admins can delete weekly menu" ON weekly_menu;
DROP TRIGGER IF EXISTS update_weekly_menu_updated_at ON weekly_menu;

CREATE TABLE IF NOT EXISTS weekly_menu (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  week_start DATE NOT NULL,
  day_name TEXT NOT NULL CHECK (day_name IN ('monday','tuesday','wednesday','thursday','friday','saturday')),
  day_ar TEXT DEFAULT '',
  lunch TEXT DEFAULT '',
  dinner TEXT DEFAULT '',
  publish_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(week_start, day_name)
);

CREATE INDEX IF NOT EXISTS idx_weekly_menu_week ON weekly_menu(week_start);

ALTER TABLE weekly_menu ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read weekly menu"
  ON weekly_menu FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage weekly menu"
  ON weekly_menu FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update weekly menu"
  ON weekly_menu FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete weekly menu"
  ON weekly_menu FOR DELETE
  USING (public.is_admin());

CREATE TRIGGER update_weekly_menu_updated_at
  BEFORE UPDATE ON weekly_menu
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
