DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'survey_submissions_flat') THEN
    DROP POLICY IF EXISTS "Users can read own submissions" ON survey_submissions_flat;
    DROP POLICY IF EXISTS "Admins can read all submissions" ON survey_submissions_flat;
    DROP POLICY IF EXISTS "Users can insert own submissions" ON survey_submissions_flat;
    DROP POLICY IF EXISTS "Users can update own submissions" ON survey_submissions_flat;
    DROP POLICY IF EXISTS "Admins can update any submission" ON survey_submissions_flat;
    DROP POLICY IF EXISTS "Admins can delete submissions" ON survey_submissions_flat;
    DROP TRIGGER IF EXISTS update_survey_submissions_flat_updated_at ON survey_submissions_flat;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS survey_submissions_flat (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_id DATE NOT NULL,
  thali_number TEXT,
  email TEXT,
  -- Status fields for each day+meal slot
  mon_l_status TEXT CHECK (mon_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  mon_l_dish_1 TEXT, mon_l_dish_2 TEXT, mon_l_dish_3 TEXT, mon_l_dish_4 TEXT,
  mon_d_status TEXT CHECK (mon_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  mon_d_dish_1 TEXT, mon_d_dish_2 TEXT, mon_d_dish_3 TEXT, mon_d_dish_4 TEXT,
  tue_l_status TEXT CHECK (tue_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  tue_l_dish_1 TEXT, tue_l_dish_2 TEXT, tue_l_dish_3 TEXT, tue_l_dish_4 TEXT,
  tue_d_status TEXT CHECK (tue_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  tue_d_dish_1 TEXT, tue_d_dish_2 TEXT, tue_d_dish_3 TEXT, tue_d_dish_4 TEXT,
  wed_l_status TEXT CHECK (wed_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  wed_l_dish_1 TEXT, wed_l_dish_2 TEXT, wed_l_dish_3 TEXT, wed_l_dish_4 TEXT,
  wed_d_status TEXT CHECK (wed_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  wed_d_dish_1 TEXT, wed_d_dish_2 TEXT, wed_d_dish_3 TEXT, wed_d_dish_4 TEXT,
  thu_l_status TEXT CHECK (thu_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  thu_l_dish_1 TEXT, thu_l_dish_2 TEXT, thu_l_dish_3 TEXT, thu_l_dish_4 TEXT,
  thu_d_status TEXT CHECK (thu_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  thu_d_dish_1 TEXT, thu_d_dish_2 TEXT, thu_d_dish_3 TEXT, thu_d_dish_4 TEXT,
  fri_l_status TEXT CHECK (fri_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  fri_l_dish_1 TEXT, fri_l_dish_2 TEXT, fri_l_dish_3 TEXT, fri_l_dish_4 TEXT,
  fri_d_status TEXT CHECK (fri_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  fri_d_dish_1 TEXT, fri_d_dish_2 TEXT, fri_d_dish_3 TEXT, fri_d_dish_4 TEXT,
  sat_l_status TEXT CHECK (sat_l_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  sat_l_dish_1 TEXT, sat_l_dish_2 TEXT, sat_l_dish_3 TEXT, sat_l_dish_4 TEXT,
  sat_d_status TEXT CHECK (sat_d_status IN ('Applied', 'Skipped', 'opted_in', 'opted_out')),
  sat_d_dish_1 TEXT, sat_d_dish_2 TEXT, sat_d_dish_3 TEXT, sat_d_dish_4 TEXT,
  edit_metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_week ON survey_submissions_flat(week_id);
CREATE INDEX IF NOT EXISTS idx_survey_user ON survey_submissions_flat(user_id);

ALTER TABLE survey_submissions_flat ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own submissions"
  ON survey_submissions_flat FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all submissions"
  ON survey_submissions_flat FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Users can insert own submissions"
  ON survey_submissions_flat FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own submissions"
  ON survey_submissions_flat FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can update any submission"
  ON survey_submissions_flat FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete submissions"
  ON survey_submissions_flat FOR DELETE
  USING (public.is_admin());

CREATE TRIGGER update_survey_submissions_flat_updated_at
  BEFORE UPDATE ON survey_submissions_flat
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
