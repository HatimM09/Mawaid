-- Fix notifications schema so all in-app notification flows work correctly.

-- 1. Drop the restrictive type CHECK — the app uses types like 'new_request',
--    'new_query', 'request_approved', 'request_rejected', 'query_resolved',
--    'query_reply', 'test' which are not in the original allow-list.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- 2. Allow a member to insert a notification row for themselves (e.g. the
--    "Weekly Survey Submitted" confirmation). Read/delete stay restricted to
--    the owner; admin + service_role inserts continue to work as before.
DROP POLICY IF EXISTS "Members can insert own notifications" ON notifications;
CREATE POLICY "Members can insert own notifications"
  ON notifications FOR INSERT
  WITH CHECK (auth.uid() = user_id);
