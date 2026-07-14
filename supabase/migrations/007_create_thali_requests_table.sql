DROP POLICY IF EXISTS "Users can read own requests" ON thali_requests;
DROP POLICY IF EXISTS "Users can insert own requests" ON thali_requests;
DROP POLICY IF EXISTS "Admins can read all requests" ON thali_requests;
DROP POLICY IF EXISTS "Admins can update requests" ON thali_requests;
DROP POLICY IF EXISTS "Admins can delete requests" ON thali_requests;
DROP TRIGGER IF EXISTS update_thali_requests_updated_at ON thali_requests;

CREATE TABLE IF NOT EXISTS thali_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('resume', 'stop', 'extra', 'miqaat', 'change')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  from_date DATE,
  to_date DATE,
  meal_type TEXT CHECK (meal_type IN ('lunch', 'dinner', 'both')),
  details TEXT,
  extra_items JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_thali_requests_user ON thali_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_thali_requests_status ON thali_requests(status);

ALTER TABLE thali_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own requests"
  ON thali_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own requests"
  ON thali_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can read all requests"
  ON thali_requests FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can update requests"
  ON thali_requests FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete requests"
  ON thali_requests FOR DELETE
  USING (public.is_admin());

CREATE TRIGGER update_thali_requests_updated_at
  BEFORE UPDATE ON thali_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
