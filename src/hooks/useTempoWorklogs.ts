import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TempoWorklog {
  issueKey: string;
  issueSummary: string;
  assignee: string;
  author: string;
  timeSpentSeconds: number;
  startDate: string;
  description: string | null;
}

export const useTempoWorklogs = (
  projectId: string | null,
  from?: string,
  to?: string
) => {
  return useQuery({
    queryKey: ["tempo-worklogs", projectId, from, to],
    queryFn: async (): Promise<TempoWorklog[]> => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Not authenticated");

      const params = new URLSearchParams({ project_id: projectId! });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      // Cache-buster to avoid stale CDN responses
      params.set("_ts", Date.now().toString());

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-tempo-worklogs?${params}`,
        { cache: "no-store", headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to fetch worklogs");
      }

      const data = await res.json();
      return data.worklogs ?? data;
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
  });
};
