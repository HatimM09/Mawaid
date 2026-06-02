-- ══════════════════════════════════════════════════════════════
-- Al-Mawaid Broadcast System — Database Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- 1. Broadcast Templates (saveable notification templates)
CREATE TABLE IF NOT EXISTS public.broadcast_templates (
  id            BIGSERIAL PRIMARY KEY,
  name          TEXT NOT NULL DEFAULT '',
  title         TEXT NOT NULL DEFAULT '',
  body          TEXT DEFAULT '',
  sender_name   TEXT DEFAULT 'Admin Office',
  tone          TEXT DEFAULT 'var(--accent-primary)',
  media_url     TEXT DEFAULT '',
  target_type   TEXT DEFAULT 'all',
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- 2. Broadcast Schedule (tracks scheduled & sent broadcasts)
CREATE TABLE IF NOT EXISTS public.broadcast_schedule (
  id              BIGSERIAL PRIMARY KEY,
  notice_id       BIGINT REFERENCES public.notices(id) ON DELETE CASCADE,
  title           TEXT NOT NULL DEFAULT '',
  body            TEXT DEFAULT '',
  sender_name     TEXT DEFAULT 'Admin Office',
  tone            TEXT DEFAULT 'var(--accent-primary)',
  media_url       TEXT DEFAULT '',
  target_type     TEXT DEFAULT 'all',
  target_user_id  UUID DEFAULT NULL,
  status          TEXT DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sending', 'sent', 'failed', 'scheduled')),
  scheduled_for   TIMESTAMPTZ DEFAULT NULL,
  sent_at         TIMESTAMPTZ DEFAULT NULL,
  total_targets   INT DEFAULT 0,
  sent_count      INT DEFAULT 0,
  failed_count    INT DEFAULT 0,
  delivered_count INT DEFAULT 0,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_broadcast_schedule_status
  ON public.broadcast_schedule (status);
CREATE INDEX IF NOT EXISTS idx_broadcast_schedule_scheduled_for
  ON public.broadcast_schedule (scheduled_for);
CREATE INDEX IF NOT EXISTS idx_broadcast_templates_name
  ON public.broadcast_templates (name);

-- RLS for broadcast_templates
ALTER TABLE public.broadcast_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read templates"
  ON public.broadcast_templates FOR SELECT USING (true);
CREATE POLICY "Admins can manage templates"
  ON public.broadcast_templates FOR ALL USING (true);

-- RLS for broadcast_schedule
ALTER TABLE public.broadcast_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read schedule"
  ON public.broadcast_schedule FOR SELECT USING (true);
CREATE POLICY "Admins can manage schedule"
  ON public.broadcast_schedule FOR ALL USING (true);

-- Enable Realtime for broadcast tables
-- Note: IF NOT EXISTS is not supported for ALTER PUBLICATION
-- Run these separately if the tables aren't already in the publication:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_schedule;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.broadcast_templates;
