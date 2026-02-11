import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useClientProjects } from "@/hooks/useClientProjects";
import { useJiraIssues } from "@/hooks/useJiraIssues";
import { useTempoWorklogs } from "@/hooks/useTempoWorklogs";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut } from "lucide-react";
import ProjectSelector from "@/components/dashboard/ProjectSelector";
import GanttChart from "@/components/dashboard/GanttChart";
import TimeTrackingTable from "@/components/dashboard/TimeTrackingTable";
import MonthlyHoursTable from "@/components/dashboard/MonthlyHoursTable";
import ProjectMetrics from "@/components/dashboard/ProjectMetrics";

const ClientDashboard = () => {
  const { user, signOut } = useAuth();
  const { data: projects = [], isLoading: projectsLoading } = useClientProjects();
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const activeId = selectedProjectId ?? (projects.length > 0 ? projects[0].id : null);

  const { data: issues = [], isLoading: issuesLoading } = useJiraIssues(activeId);
  const { data: worklogs = [], isLoading: worklogsLoading } = useTempoWorklogs(activeId);

  // Auto-select first project
  if (!selectedProjectId && projects.length > 0) {
    // Using a ref-like approach to avoid re-render loop
    setTimeout(() => setSelectedProjectId(projects[0].id), 0);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="h-16 border-b border-border bg-card flex items-center justify-between px-8">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-heading font-bold text-sm">T</span>
          </div>
          <h1 className="text-xl font-heading font-bold text-foreground">Client Dashboard</h1>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">{user?.email}</span>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      <main className="p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <ProjectSelector
            projects={projects}
            selectedId={activeId}
            onSelect={setSelectedProjectId}
            isLoading={projectsLoading}
          />
        </div>

        {activeId && (
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
                <TabsTrigger value="monthly">Monthly Hours</TabsTrigger>
              </TabsList>

              <TabsContent value="gantt">
                <GanttChart issues={issues} isLoading={issuesLoading} />
              </TabsContent>

              <TabsContent value="time">
                <TimeTrackingTable worklogs={worklogs} isLoading={worklogsLoading} />
              </TabsContent>

              <TabsContent value="monthly">
                <MonthlyHoursTable worklogs={worklogs} isLoading={worklogsLoading} />
              </TabsContent>
            </Tabs>
          </>
        )}
      </main>
    </div>
  );
};

export default ClientDashboard;
