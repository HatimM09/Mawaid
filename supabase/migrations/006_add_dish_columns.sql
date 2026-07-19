-- Add dish_5 and dish_6 columns for all day+meal combos
-- so menus with 5+ dishes can be saved properly

ALTER TABLE survey_submissions_flat
  ADD COLUMN IF NOT EXISTS mon_l_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS mon_l_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS mon_d_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS tue_l_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS tue_d_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS wed_l_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS wed_d_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS thu_l_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS thu_d_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS fri_l_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS fri_d_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS sat_l_dish_6 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_5 TEXT,
  ADD COLUMN IF NOT EXISTS sat_d_dish_6 TEXT;
