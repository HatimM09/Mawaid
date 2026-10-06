-- Migration 053: allow members to insert their own monthly dues reminders
-- The Dues & Payments page writes ONE self-targeted reminder per unpaid month
-- into `notices` so it appears in the member's Alerts tab + badge (no popup).
-- Narrowly scoped: own user only, reminder type, dues title prefix.
DROP POLICY IF EXISTS "Members can insert own dues reminders" ON notices;

CREATE POLICY "Members can insert own dues reminders"
  ON notices FOR INSERT
  WITH CHECK (
    auth.uid() = target_user_id
    AND type = 'reminder'
    AND title LIKE 'Thali Contribution Due%'
  );
