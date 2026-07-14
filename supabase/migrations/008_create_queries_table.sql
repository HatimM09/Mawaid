DROP POLICY IF EXISTS "Users can read own queries" ON queries;
DROP POLICY IF EXISTS "Users can insert own queries" ON queries;
DROP POLICY IF EXISTS "Admins can read all queries" ON queries;
DROP POLICY IF EXISTS "Admins can update queries" ON queries;
DROP POLICY IF EXISTS "Admins can delete queries" ON queries;
DROP TRIGGER IF EXISTS update_queries_updated_at ON queries;

CREATE TABLE IF NOT EXISTS queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  comment TEXT NOT NULL,
  media JSONB,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  admin_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_queries_user ON queries(user_id);
CREATE INDEX IF NOT EXISTS idx_queries_status ON queries(status);

ALTER TABLE queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own queries"
  ON queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own queries"
  ON queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all queries"
  ON queries FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update queries"
  ON queries FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete queries"
  ON queries FOR DELETE
  USING (public.is_admin());

CREATE TRIGGER update_queries_updated_at
  BEFORE UPDATE ON queries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
