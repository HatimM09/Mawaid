DROP POLICY IF EXISTS "Users can read own stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can read all user stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can insert user stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can update user stats" ON user_stats;
DROP POLICY IF EXISTS "Admins can delete user stats" ON user_stats;
DROP POLICY IF EXISTS "Users can insert own stats" ON user_stats;
DROP TRIGGER IF EXISTS update_user_stats_updated_at ON user_stats;

CREATE TABLE IF NOT EXISTS user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT DEFAULT '',
  email TEXT DEFAULT '',
  thali_number INTEGER,
  phone TEXT DEFAULT '',
  address TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'khidmat_guzar', 'supervisor', 'inventory_manager', 'cook')),
  avatar_url TEXT,
  snack_defaults JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_stats_email ON user_stats(email);
CREATE INDEX IF NOT EXISTS idx_user_stats_role ON user_stats(role);
CREATE INDEX IF NOT EXISTS idx_user_stats_thali ON user_stats(thali_number);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own stats"
  ON user_stats FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all user stats"
  ON user_stats FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert user stats"
  ON user_stats FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update user stats"
  ON user_stats FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete user stats"
  ON user_stats FOR DELETE
  USING (public.is_admin());

-- Bootstrap: user can insert own stats on registration
CREATE POLICY "Users can insert own stats"
  ON user_stats FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auto-update timestamp
CREATE TRIGGER update_user_stats_updated_at
  BEFORE UPDATE ON user_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
