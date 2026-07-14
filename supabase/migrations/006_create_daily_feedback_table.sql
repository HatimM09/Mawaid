DROP POLICY IF EXISTS "Users can read own feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Admins can read all feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Users can insert own feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Users can update own feedback" ON daily_feedback;
DROP POLICY IF EXISTS "Admins can delete feedback" ON daily_feedback;

CREATE TABLE IF NOT EXISTS daily_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  lunch_stars INTEGER CHECK (lunch_stars BETWEEN 1 AND 5),
  lunch_emoji TEXT,
  dinner_stars INTEGER CHECK (dinner_stars BETWEEN 1 AND 5),
  dinner_emoji TEXT,
  lunch_comment TEXT,
  dinner_comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_feedback_day ON daily_feedback(day);
CREATE INDEX IF NOT EXISTS idx_feedback_user ON daily_feedback(user_id);

ALTER TABLE daily_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own feedback"
  ON daily_feedback FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all feedback"
  ON daily_feedback FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Users can insert own feedback"
  ON daily_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own feedback"
  ON daily_feedback FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete feedback"
  ON daily_feedback FOR DELETE
  USING (public.is_admin());
