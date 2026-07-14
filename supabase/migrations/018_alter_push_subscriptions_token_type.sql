-- Add 'fcm' to the token_type CHECK constraint to support Capacitor native FCM push
ALTER TABLE push_subscriptions
DROP CONSTRAINT IF EXISTS push_subscriptions_token_type_check;

ALTER TABLE push_subscriptions
ADD CONSTRAINT push_subscriptions_token_type_check
CHECK (token_type IN ('webpush', 'expo', 'fcm'));
