-- Add priority, category, assigned_to, subject, and updated_at to queries table

ALTER TABLE public.queries
  ADD COLUMN IF NOT EXISTS priority    TEXT DEFAULT 'medium'
    CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

ALTER TABLE public.queries
  ADD COLUMN IF NOT EXISTS category    TEXT DEFAULT 'general'
    CHECK (category IN ('general', 'thali', 'delivery', 'miqaat', 'account', 'other'));

ALTER TABLE public.queries
  ADD COLUMN IF NOT EXISTS assigned_to UUID DEFAULT NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.queries
  ADD COLUMN IF NOT EXISTS subject     TEXT DEFAULT '';

ALTER TABLE public.queries
  ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMPTZ DEFAULT now();

-- Extend status check constraint to include 'closed'
ALTER TABLE public.queries DROP CONSTRAINT IF EXISTS queries_status_check;
ALTER TABLE public.queries ADD CONSTRAINT queries_status_check
  CHECK (status IN ('open', 'resolved', 'in_progress', 'closed'));

-- Row level security
ALTER TABLE public.queries ENABLE ROW LEVEL SECURITY;

-- Row level security policies for queries table
CREATE POLICY IF NOT EXISTS "Users can view own queries" ON public.queries
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own queries" ON public.queries
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Admins can view all queries" ON public.queries
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role = 'admin')
  );

CREATE POLICY IF NOT EXISTS "Admins can update all queries" ON public.queries
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid() AND role = 'admin')
  );
