
-- Table to store shared report links
CREATE TABLE public.newman_shared_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.newman_test_runs(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.newman_shared_reports ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shared links
CREATE POLICY "Owner can insert shared_reports"
ON public.newman_shared_reports FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owner can select shared_reports"
ON public.newman_shared_reports FOR SELECT
USING (auth.uid() = created_by);

CREATE POLICY "Owner can delete shared_reports"
ON public.newman_shared_reports FOR DELETE
USING (auth.uid() = created_by);

-- Public read by token (for shared access)
CREATE POLICY "Anyone can select by share_token"
ON public.newman_shared_reports FOR SELECT
USING (true);

-- Index for fast token lookup
CREATE INDEX idx_shared_reports_token ON public.newman_shared_reports(share_token);
