
-- Drop overly permissive public SELECT policies
DROP POLICY "Anyone can select by share_token" ON public.newman_shared_reports;
DROP POLICY "Anyone can select by share_token" ON public.k6_shared_reports;
