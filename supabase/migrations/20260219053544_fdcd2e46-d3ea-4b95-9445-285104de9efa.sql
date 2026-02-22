
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Projects table
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- Helper function (after projects table exists)
CREATE OR REPLACE FUNCTION public.is_project_owner(project_id_param uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects WHERE id = project_id_param AND user_id = auth.uid())
$$;

-- Newman Collections
CREATE TABLE public.newman_collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_url text,
  collection_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newman_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select newman_collections" ON public.newman_collections FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert newman_collections" ON public.newman_collections FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update newman_collections" ON public.newman_collections FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete newman_collections" ON public.newman_collections FOR DELETE USING (public.is_project_owner(project_id));

-- Newman Environments
CREATE TABLE public.newman_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  values jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newman_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select newman_environments" ON public.newman_environments FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert newman_environments" ON public.newman_environments FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update newman_environments" ON public.newman_environments FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete newman_environments" ON public.newman_environments FOR DELETE USING (public.is_project_owner(project_id));

-- Newman Test Runs
CREATE TABLE public.newman_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  collection_id uuid REFERENCES public.newman_collections(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES public.newman_environments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  result_data jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.newman_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select newman_test_runs" ON public.newman_test_runs FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert newman_test_runs" ON public.newman_test_runs FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update newman_test_runs" ON public.newman_test_runs FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete newman_test_runs" ON public.newman_test_runs FOR DELETE USING (public.is_project_owner(project_id));

-- K6 Swagger Files
CREATE TABLE public.k6_swagger_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  file_url text,
  swagger_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.k6_swagger_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select k6_swagger_files" ON public.k6_swagger_files FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert k6_swagger_files" ON public.k6_swagger_files FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update k6_swagger_files" ON public.k6_swagger_files FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete k6_swagger_files" ON public.k6_swagger_files FOR DELETE USING (public.is_project_owner(project_id));

-- K6 Environments
CREATE TABLE public.k6_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  values jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.k6_environments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select k6_environments" ON public.k6_environments FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert k6_environments" ON public.k6_environments FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update k6_environments" ON public.k6_environments FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete k6_environments" ON public.k6_environments FOR DELETE USING (public.is_project_owner(project_id));

-- K6 Test Configs
CREATE TABLE public.k6_test_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  vus integer NOT NULL DEFAULT 10,
  duration text NOT NULL DEFAULT '30s',
  thresholds jsonb DEFAULT '{}'::jsonb,
  script text,
  swagger_file_id uuid REFERENCES public.k6_swagger_files(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.k6_test_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select k6_test_configs" ON public.k6_test_configs FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert k6_test_configs" ON public.k6_test_configs FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update k6_test_configs" ON public.k6_test_configs FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete k6_test_configs" ON public.k6_test_configs FOR DELETE USING (public.is_project_owner(project_id));

-- K6 Test Runs
CREATE TABLE public.k6_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  test_config_id uuid REFERENCES public.k6_test_configs(id) ON DELETE SET NULL,
  environment_id uuid REFERENCES public.k6_environments(id) ON DELETE SET NULL,
  k6_cloud_test_id text,
  status text NOT NULL DEFAULT 'pending',
  result_data jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.k6_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can select k6_test_runs" ON public.k6_test_runs FOR SELECT USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can insert k6_test_runs" ON public.k6_test_runs FOR INSERT WITH CHECK (public.is_project_owner(project_id));
CREATE POLICY "Owner can update k6_test_runs" ON public.k6_test_runs FOR UPDATE USING (public.is_project_owner(project_id));
CREATE POLICY "Owner can delete k6_test_runs" ON public.k6_test_runs FOR DELETE USING (public.is_project_owner(project_id));

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_newman_collections_updated_at BEFORE UPDATE ON public.newman_collections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_newman_environments_updated_at BEFORE UPDATE ON public.newman_environments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_k6_swagger_files_updated_at BEFORE UPDATE ON public.k6_swagger_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_k6_environments_updated_at BEFORE UPDATE ON public.k6_environments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_k6_test_configs_updated_at BEFORE UPDATE ON public.k6_test_configs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
