
-- Create storage bucket for newman test files
INSERT INTO storage.buckets (id, name, public) VALUES ('newman-files', 'newman-files', false);

-- RLS policies for newman-files bucket
CREATE POLICY "Authenticated users can upload newman files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'newman-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can read newman files"
ON storage.objects FOR SELECT
USING (bucket_id = 'newman-files' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete newman files"
ON storage.objects FOR DELETE
USING (bucket_id = 'newman-files' AND auth.role() = 'authenticated');

-- Table to track files per collection
CREATE TABLE public.newman_collection_files (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID NOT NULL REFERENCES public.newman_collections(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.newman_collection_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can select newman_collection_files"
ON public.newman_collection_files FOR SELECT
USING (is_project_owner(project_id));

CREATE POLICY "Owner can insert newman_collection_files"
ON public.newman_collection_files FOR INSERT
WITH CHECK (is_project_owner(project_id));

CREATE POLICY "Owner can delete newman_collection_files"
ON public.newman_collection_files FOR DELETE
USING (is_project_owner(project_id));
