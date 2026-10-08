-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Migration 054: WhatsApp Chatbot tables
-- Backing tables for the whatsapp-bot Supabase Edge Function.
-- The bot talks to Supabase with the service role key, so these
-- tables are written by the function itself; RLS below only grants
-- admins read access for support/monitoring.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. whatsapp_users: WhatsApp phone → member link ──
-- wa_phone is digits-only WITH country code (e.g. 919876543210),
-- exactly the `wa_id` Meta sends on the webhook.
CREATE TABLE IF NOT EXISTS whatsapp_users (
  wa_phone TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  thali_number TEXT,
  name TEXT DEFAULT '',
  linked_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_users_user ON whatsapp_users(user_id);

-- ── 2. whatsapp_sessions: per-chat conversation state ──
-- `state` holds the active flow (survey steps, feedback steps…).
-- last_msg_id dedupes Meta webhook retries.
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  wa_phone TEXT PRIMARY KEY,
  state JSONB DEFAULT '{}'::jsonb,
  last_msg_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_updated ON whatsapp_sessions(updated_at DESC);

-- ── 3. Auto-update timestamps ──
DROP TRIGGER IF EXISTS update_whatsapp_users_updated_at ON whatsapp_users;
CREATE TRIGGER update_whatsapp_users_updated_at
  BEFORE UPDATE ON whatsapp_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_whatsapp_sessions_updated_at ON whatsapp_sessions;
CREATE TRIGGER update_whatsapp_sessions_updated_at
  BEFORE UPDATE ON whatsapp_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ── 4. RLS — service role writes via the edge function; ──
--        admins get read-only visibility for support.
ALTER TABLE whatsapp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read whatsapp links" ON whatsapp_users;
CREATE POLICY "Admins can read whatsapp links"
  ON whatsapp_users FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can read whatsapp sessions" ON whatsapp_sessions;
CREATE POLICY "Admins can read whatsapp sessions"
  ON whatsapp_sessions FOR SELECT
  USING (public.is_admin());
