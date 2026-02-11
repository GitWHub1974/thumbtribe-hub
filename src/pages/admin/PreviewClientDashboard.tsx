import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useJiraIssues } from "@/hooks/useJiraIssues";
import { useTempoWorklogs } from "@/hooks/useTempoWorklogs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Eye } from "lucide-react";
import GanttChart from "@/components/dashboard/GanttChart";
import TimeTrackingTable from "@/components/dashboard/TimeTrackingTable";
import ProjectMetrics from "@/components/dashboard/ProjectMetrics";

const PreviewClientDashboard = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { data: project } = useQuery({
    queryKey: ["admin-project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: issues = [], isLoading: issuesLoading } = useJiraIssues(projectId ?? null);
  const { data: worklogs = [], isLoading: worklogsLoading } = useTempoWorklogs(projectId ?? null);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back
        </Button>
        <div className="flex items-center gap-2">
          <Eye className="w-5 h-5 text-muted-foreground" />
          <h1 className="text-2xl font-heading font-bold text-foreground">
            Client Preview
          </h1>
        </div>
        <Badge variant="outline" className="text-xs">
          {project?.name ?? "Loading..."}
        </Badge>
      </div>

      {projectId && (
        <>
          <ProjectMetrics
            issues={issues}
            worklogs={worklogs}
            isLoading={issuesLoading || worklogsLoading}
          />

          <Tabs defaultValue="gantt" className="space-y-4">
            <TabsList>
              <TabsTrigger value="gantt">Project Plan</TabsTrigger>
              <TabsTrigger value="time">Time Tracking</TabsTrigger>
            </TabsList>

            <TabsContent value="gantt">
              <GanttChart issues={issues} isLoading={issuesLoading} />
            </TabsContent>

            <TabsContent value="time">
              <TimeTrackingTable worklogs={worklogs} isLoading={worklogsLoading} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
};

export default PreviewClientDashboard;
