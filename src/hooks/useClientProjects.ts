import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ClientProject {
  id: string;
  name: string;
  jira_project_key: string;
  description: string | null;
}

export const useClientProjects = () => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["client-projects", user?.id],
    queryFn: async (): Promise<ClientProject[]> => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("client_projects")
        .select("project_id, projects(id, name, jira_project_key, description)")
        .eq("client_id", user.id);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.projects.id,
        name: row.projects.name,
        jira_project_key: row.projects.jira_project_key,
        description: row.projects.description,
      }));
    },
    enabled: !!user,
  });
};
