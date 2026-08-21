-- ═══════════════════════════════════════════════════════════════
-- AL-MAWAID — Notifications read/archive + admin policy fixes (043)
--
-- Fixes surfaced by the UX feature audit:
--   1. notifications: add read_at / archived_at columns (the web + admin
--      notification views query them but they never existed) + an UPDATE
--      policy so members can mark read/unread/archive their own rows.
--   2. notifications: admin SELECT + DELETE policies so admin flows
--      (broadcast bell, rpcDeleteUser cleanup) can read/delete any row.
--   3. push_subscriptions: admin DELETE policy for rpcDeleteUser cleanup.
--   4. survey_override_responses: admin UPDATE policy so the erase
--      direct-update fallback (eraseOverrideSlot) works — previously only
--      the RPC path was allowed.
--   5. staff: SECURITY DEFINER RPCs for the broken login flows —
--        • login_lookup_inventory_manager  → anonymous email lookup used by
--          the Inventory Manager kiosk login (never exposes non-inventory rows)
--        • link_staff_user_id              → lets a signed-in staff member
--          self-link their user_id ONLY when their JWT email matches the row,
--          replacing the admin-only UPDATE that silently broke khidmat logins.
-- Idempotent — safe to re-run.
-- ═══════════════════════════════════════════════════════════════

-- ── 1. notifications: add read/archive columns ─────────────────
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, read_at);
CREATE INDEX IF NOT EXISTS idx_notifications_archived ON notifications(user_id, archived_at);

-- ── 2. notifications: owner UPDATE + admin SELECT/DELETE ───────
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can read all notifications" ON notifications;
CREATE POLICY "Admins can read all notifications"
  ON notifications FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete notifications" ON notifications;
CREATE POLICY "Admins can delete notifications"
  ON notifications FOR DELETE
  USING (public.is_admin());

-- ── 3. push_subscriptions: admin DELETE ────────────────────────
DROP POLICY IF EXISTS "Admins can delete subscriptions" ON push_subscriptions;
CREATE POLICY "Admins can delete subscriptions"
  ON push_subscriptions FOR DELETE
  USING (public.is_admin());

-- ── 4. (removed) survey_override_responses was dropped in 038 — no policy needed
-- Previously targeted survey_override_responses which no longer exists; kept empty for migration idempotence.

-- ── 5. staff login RPCs ────────────────────────────────────────

-- Inventory Manager kiosk login: email-only lookup that runs as the table
-- owner (bypasses RLS) but is constrained to inventory_manager rows and the
-- exact email — it can never return other staff or other roles.
CREATE OR REPLACE FUNCTION public.login_lookup_inventory_manager(p_email TEXT)
RETURNS TABLE (id UUID, user_id UUID, email TEXT, role TEXT, name TEXT, phone TEXT)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, user_id, email, role, name, phone
  FROM public.staff
  WHERE role = 'inventory_manager'
    AND email = p_email
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.login_lookup_inventory_manager(TEXT) TO anon, authenticated;

-- Staff self-link: signed-in member links their auth user_id to their own
-- staff row. Only allowed when the caller's JWT email matches the staff row,
-- and only when the row is unlinked (or already linked to them). Admins keep
-- full UPDATE via the existing admin policy.
CREATE OR REPLACE FUNCTION public.link_staff_user_id(p_staff_id UUID, p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE v_email TEXT;
BEGIN
  IF p_user_id IS NULL OR p_user_id <> auth.uid() THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'user_mismatch');
  END IF;

  SELECT s.email INTO v_email
  FROM public.staff s
  WHERE s.id = p_staff_id;

  IF v_email IS NULL OR lower(v_email) <> lower(coalesce(auth.jwt() ->> 'email', '')) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'email_mismatch');
  END IF;

  UPDATE public.staff
  SET user_id = p_user_id
  WHERE id = p_staff_id
    AND (user_id IS NULL OR user_id = p_user_id);

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_staff_user_id(UUID, UUID) TO authenticated;

-- ── Realtime: ensure notifications stay live ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;