
-- k6 shared reports (same pattern as newman_shared_reports)
CREATE TABLE public.k6_shared_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.k6_test_runs(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.k6_shared_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can select by share_token" ON public.k6_shared_reports FOR SELECT USING (true);
CREATE POLICY "Owner can insert k6_shared_reports" ON public.k6_shared_reports FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can delete k6_shared_reports" ON public.k6_shared_reports FOR DELETE USING (auth.uid() = created_by);

-- Shared report bundles
CREATE TABLE public.shared_report_bundles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_token TEXT NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'::text),
  title TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_report_bundles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can select bundles by token" ON public.shared_report_bundles FOR SELECT USING (true);
CREATE POLICY "Owner can insert bundles" ON public.shared_report_bundles FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owner can delete bundles" ON public.shared_report_bundles FOR DELETE USING (auth.uid() = created_by);

-- Bundle items
CREATE TABLE public.shared_report_bundle_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bundle_id UUID NOT NULL REFERENCES public.shared_report_bundles(id) ON DELETE CASCADE,
  runner_type TEXT NOT NULL CHECK (runner_type IN ('newman', 'k6')),
  run_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_report_bundle_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can select bundle items" ON public.shared_report_bundle_items FOR SELECT USING (true);
CREATE POLICY "Owner can insert bundle items" ON public.shared_report_bundle_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.shared_report_bundles WHERE id = bundle_id AND created_by = auth.uid())
);
CREATE POLICY "Owner can delete bundle items" ON public.shared_report_bundle_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.shared_report_bundles WHERE id = bundle_id AND created_by = auth.uid())
);
