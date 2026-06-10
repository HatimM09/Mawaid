-- Add lunch_comment and dinner_comment columns to daily_feedback
ALTER TABLE public.daily_feedback
  ADD COLUMN IF NOT EXISTS lunch_comment TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS dinner_comment TEXT DEFAULT '';
