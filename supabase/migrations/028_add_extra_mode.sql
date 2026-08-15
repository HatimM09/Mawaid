-- Add extra_mode column to thali_requests
-- Used by "Add Extra Food" requests to distinguish Addition vs Deduction
ALTER TABLE thali_requests ADD COLUMN IF NOT EXISTS extra_mode TEXT DEFAULT 'addition' CHECK (extra_mode IN ('addition', 'deduction'));
