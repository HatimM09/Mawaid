-- Add updated_at column to thali_requests and queries tables
-- thali_requests
ALTER TABLE IF EXISTS public.thali_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- queries (if not already applied)
ALTER TABLE IF EXISTS public.queries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Auto-update updated_at on row modification for thali_requests
CREATE OR REPLACE FUNCTION public.update_thali_requests_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_thali_requests_updated_at ON public.thali_requests;
CREATE TRIGGER set_thali_requests_updated_at
  BEFORE UPDATE ON public.thali_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_thali_requests_timestamp();

-- Auto-update updated_at on row modification for queries
CREATE OR REPLACE FUNCTION public.update_queries_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_queries_updated_at ON public.queries;
CREATE TRIGGER set_queries_updated_at
  BEFORE UPDATE ON public.queries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_queries_timestamp();
