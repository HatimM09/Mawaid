DROP POLICY IF EXISTS "Admins can read schedule" ON broadcast_schedule;
DROP POLICY IF EXISTS "Admins can insert schedule" ON broadcast_schedule;
DROP POLICY IF EXISTS "Admins can update schedule" ON broadcast_schedule;
DROP POLICY IF EXISTS "Admins can delete schedule" ON broadcast_schedule;
DROP TRIGGER IF EXISTS update_broadcast_schedule_updated_at ON broadcast_schedule;

CREATE TABLE IF NOT EXISTS broadcast_schedule (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  notice_id UUID REFERENCES notices(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  sender_name TEXT DEFAULT 'System',
  tone TEXT,
  media_url TEXT,
  target_type TEXT NOT NULL DEFAULT 'all' CHECK (target_type IN ('all', 'specific', 'admins', 'opt_in', 'opt_out')),
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  channel TEXT DEFAULT 'in-app' CHECK (channel IN ('in-app', 'push', 'both')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'sending', 'sent', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  total_targets INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_broadcast_status ON broadcast_schedule(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_scheduled ON broadcast_schedule(scheduled_for);

ALTER TABLE broadcast_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read schedule"
  ON broadcast_schedule FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Admins can insert schedule"
  ON broadcast_schedule FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update schedule"
  ON broadcast_schedule FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete schedule"
  ON broadcast_schedule FOR DELETE
  USING (public.is_admin());

CREATE TRIGGER update_broadcast_schedule_updated_at
  BEFORE UPDATE ON broadcast_schedule
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
