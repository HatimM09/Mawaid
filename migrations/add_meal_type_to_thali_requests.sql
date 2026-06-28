-- Add meal_type column to thali_requests for stop/resume requests
-- Values: 'lunch', 'dinner', 'both'
ALTER TABLE IF EXISTS public.thali_requests
  ADD COLUMN IF NOT EXISTS meal_type TEXT DEFAULT NULL
  CHECK (meal_type IS NULL OR meal_type IN ('lunch', 'dinner', 'both'));
