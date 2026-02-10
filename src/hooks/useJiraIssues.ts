import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface JiraIssue {
  key: string;
  summary: string;
  issueType: string;
  status: string;
  statusCategory: "todo" | "in_progress" | "done";
  assignee: string | null;
  startDate: string | null;
  dueDate: string | null;
  parentKey: string | null;
}

export const useJiraIssues = (projectId: string | null) => {
  return useQuery({
    queryKey: ["jira-issues", projectId],
    queryFn: async (): Promise<JiraIssue[]> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-jira-issues?projectId=${projectId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch Jira issues");
      }

      return res.json();
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};
