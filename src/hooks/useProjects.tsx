import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface Project {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  setCurrentProject: (p: Project | null) => void;
  loading: boolean;
  createProject: (name: string, description?: string) => Promise<Project | null>;
  refetch: () => void;
}

const ProjectContext = createContext<ProjectContextType>({
  projects: [],
  currentProject: null,
  setCurrentProject: () => {},
  loading: true,
  createProject: async () => null,
  refetch: () => {},
});

export function ProjectProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProjects = async () => {
    if (!user) { setProjects([]); setLoading(false); return; }
    const { data } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data as Project[]) || [];
    setProjects(list);
    if (!currentProject && list.length > 0) setCurrentProject(list[0]);
    setLoading(false);
  };

  useEffect(() => { fetchProjects(); }, [user]);

  const createProject = async (name: string, description?: string) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("projects")
      .insert({ name, description, user_id: user.id })
      .select()
      .single();
    if (error || !data) return null;
    const proj = data as Project;
    setProjects((p) => [proj, ...p]);
    setCurrentProject(proj);
    return proj;
  };

  return (
    <ProjectContext.Provider value={{ projects, currentProject, setCurrentProject, loading, createProject, refetch: fetchProjects }}>
      {children}
    </ProjectContext.Provider>
  );
}

export const useProjects = () => useContext(ProjectContext);
