-- Add token_type to distinguish FCM tokens from Expo push tokens
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS token_type TEXT DEFAULT 'fcm';

-- Allow multiple tokens per user (one FCM + one Expo)
ALTER TABLE public.push_subscriptions
  DROP CONSTRAINT IF EXISTS push_subscriptions_user_id_key;

-- Ensure one token per type per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_type
  ON public.push_subscriptions (user_id, token_type);
