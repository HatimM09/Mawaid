-- Add subscription_json column to store full Web Push subscription object
ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS subscription_json JSONB;

-- fcm_token will be populated with the endpoint URL for backward compat
