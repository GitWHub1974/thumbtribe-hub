import { JiraIssue } from "@/hooks/useJiraIssues";
import { TempoWorklog } from "@/hooks/useTempoWorklogs";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock } from "lucide-react";

interface ProjectMetricsProps {
  issues: JiraIssue[];
  worklogs: TempoWorklog[];
  isLoading?: boolean;
}

const ProjectMetrics = ({ issues, worklogs, isLoading }: ProjectMetricsProps) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="h-24 bg-muted animate-pulse rounded-xl" />
        ))}
      </div>
    );
  }

  const totalLoggedSeconds = worklogs.reduce((s, w) => s + w.timeSpentSeconds, 0);
  const totalLoggedHours = Math.round(totalLoggedSeconds / 3600);

  const totalEstimateSeconds = issues.reduce((s, i) => s + (i.originalEstimateSeconds || 0), 0);
  const totalEstimateHours = Math.round(totalEstimateSeconds / 3600);
  const completionPct = totalEstimateHours > 0 ? Math.min(Math.round((totalLoggedHours / totalEstimateHours) * 100), 100) : 0;

  const totalSeconds = worklogs.reduce((s, w) => s + w.timeSpentSeconds, 0);
  const totalHours = Math.round(totalSeconds / 3600);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Completion</p>
            <p className="text-2xl font-heading font-bold text-foreground">{completionPct}%</p>
            <p className="text-xs text-muted-foreground">{totalLoggedHours}h of {totalEstimateHours}h estimated</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-lg bg-chart-2/10 flex items-center justify-center">
            <Clock className="w-5 h-5 text-chart-2" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Total Hours</p>
            <p className="text-2xl font-heading font-bold text-foreground">{totalHours}h</p>
            <p className="text-xs text-muted-foreground">{worklogs.length} worklogs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProjectMetrics;
