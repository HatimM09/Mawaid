-- ══════════════════════════════════════════════════════════════
-- Al-Mawaid Push Notifications — Database Migration
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ══════════════════════════════════════════════════════════════

-- 1. Add fcm_token column to user_stats
ALTER TABLE public.user_stats 
  ADD COLUMN IF NOT EXISTS fcm_token TEXT;

-- 2. Create index for fast token lookups (used by Edge Function)
CREATE INDEX IF NOT EXISTS idx_user_stats_fcm_token 
  ON public.user_stats (user_id) 
  WHERE fcm_token IS NOT NULL;

-- 3. Allow users to update their own fcm_token
-- (The existing "Users can view/update own stats" policy already covers this,
--  but if you only have a SELECT policy, add this:)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_stats' 
    AND policyname = 'Users can update own fcm_token'
  ) THEN
    CREATE POLICY "Users can update own fcm_token" ON public.user_stats
      FOR UPDATE USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- 4. Verify: Check that the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'user_stats' AND column_name = 'fcm_token';
