
-- Add folder_name column to newman_test_runs to support per-folder execution
ALTER TABLE public.newman_test_runs ADD COLUMN folder_name TEXT DEFAULT NULL;
