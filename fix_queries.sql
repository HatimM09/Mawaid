ALTER TABLE public.queries
ADD COLUMN IF NOT EXISTS subject TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE public.queries DROP CONSTRAINT IF EXISTS queries_status_check;
ALTER TABLE public.queries ADD CONSTRAINT queries_status_check CHECK (status IN ('open', 'resolved', 'closed', 'in_progress'));
