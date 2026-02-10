import { useMemo } from "react";
import { JiraIssue } from "@/hooks/useJiraIssues";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface GanttChartProps {
  issues: JiraIssue[];
  isLoading?: boolean;
}

interface GanttRow {
  key: string;
  summary: string;
  issueType: string;
  statusCategory: "todo" | "in_progress" | "done";
  startDate: Date | null;
  dueDate: Date | null;
  depth: number;
}

const statusColors: Record<string, string> = {
  todo: "bg-muted-foreground/30",
  in_progress: "bg-chart-2",
  done: "bg-success",
};

const typeIcons: Record<string, string> = {
  Epic: "◆",
  Story: "◇",
  Task: "•",
  "Sub-task": "·",
};

const GanttChart = ({ issues, isLoading }: GanttChartProps) => {
  const { rows, minDate, maxDate, totalDays } = useMemo(() => {
    if (!issues.length) return { rows: [], minDate: new Date(), maxDate: new Date(), totalDays: 1 };

    // Build hierarchy: Epics > Stories > Tasks
    const epics = issues.filter((i) => i.issueType === "Epic");
    const stories = issues.filter((i) => i.issueType === "Story");
    const tasks = issues.filter((i) => i.issueType !== "Epic" && i.issueType !== "Story");

    const buildRows: GanttRow[] = [];

    const toRow = (issue: JiraIssue, depth: number): GanttRow => ({
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      statusCategory: issue.statusCategory,
      startDate: issue.startDate ? new Date(issue.startDate) : null,
      dueDate: issue.dueDate ? new Date(issue.dueDate) : null,
      depth,
    });

    for (const epic of epics) {
      buildRows.push(toRow(epic, 0));
      const epicStories = stories.filter((s) => s.parentKey === epic.key);
      for (const story of epicStories) {
        buildRows.push(toRow(story, 1));
        const storyTasks = tasks.filter((t) => t.parentKey === story.key);
        for (const task of storyTasks) {
          buildRows.push(toRow(task, 2));
        }
      }
    }

    // Orphan stories/tasks
    const usedStories = new Set(buildRows.filter(r => r.issueType === "Story").map(r => r.key));
    const usedTasks = new Set(buildRows.filter(r => r.issueType !== "Epic" && r.issueType !== "Story").map(r => r.key));
    for (const story of stories) {
      if (!usedStories.has(story.key)) {
        buildRows.push(toRow(story, 0));
        const storyTasks = tasks.filter((t) => t.parentKey === story.key);
        for (const task of storyTasks) {
          usedTasks.add(task.key);
          buildRows.push(toRow(task, 1));
        }
      }
    }
    for (const task of tasks) {
      if (!usedTasks.has(task.key)) buildRows.push(toRow(task, 0));
    }

    // Date range
    const allDates = buildRows
      .flatMap((r) => [r.startDate, r.dueDate])
      .filter(Boolean) as Date[];

    if (allDates.length === 0) {
      const now = new Date();
      return { rows: buildRows, minDate: now, maxDate: new Date(now.getTime() + 30 * 86400000), totalDays: 30 };
    }

    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    // Add padding
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 3);
    const days = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / 86400000));

    return { rows: buildRows, minDate: min, maxDate: max, totalDays: days };
  }, [issues]);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No issues found for this project.
      </div>
    );
  }

  const getBarStyle = (row: GanttRow) => {
    if (!row.startDate || !row.dueDate) return null;
    const start = (row.startDate.getTime() - minDate.getTime()) / 86400000;
    const duration = Math.max(1, (row.dueDate.getTime() - row.startDate.getTime()) / 86400000);
    const left = (start / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { left: `${left}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  // Month markers
  const months: { label: string; left: string }[] = [];
  const cursor = new Date(minDate);
  cursor.setDate(1);
  cursor.setMonth(cursor.getMonth() + 1);
  while (cursor <= maxDate) {
    const offset = (cursor.getTime() - minDate.getTime()) / 86400000;
    months.push({
      label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      left: `${(offset / totalDays) * 100}%`,
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="min-w-[800px]">
        {/* Month headers */}
        <div className="relative h-6 bg-muted border-b border-border">
          {months.map((m, i) => (
            <span
              key={i}
              className="absolute text-[10px] text-muted-foreground font-heading top-1"
              style={{ left: m.left }}
            >
              {m.label}
            </span>
          ))}
        </div>

        {/* Rows */}
        {rows.map((row) => {
          const barStyle = getBarStyle(row);
          return (
            <div
              key={row.key}
              className="flex items-center h-9 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              {/* Label */}
              <div
                className="w-[280px] min-w-[280px] px-3 flex items-center gap-1.5 text-xs truncate border-r border-border"
                style={{ paddingLeft: `${12 + row.depth * 16}px` }}
              >
                <span className="text-muted-foreground">{typeIcons[row.issueType] || "•"}</span>
                <span className="font-mono text-muted-foreground">{row.key}</span>
                <span className="truncate text-foreground">{row.summary}</span>
              </div>

              {/* Bar area */}
              <div className="flex-1 relative h-full">
                {barStyle ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={`absolute top-1.5 h-5 rounded-sm ${statusColors[row.statusCategory]} opacity-85 hover:opacity-100 transition-opacity cursor-default`}
                        style={barStyle}
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-heading font-semibold">{row.key}: {row.summary}</p>
                      <p className="text-xs text-muted-foreground capitalize">{row.statusCategory.replace("_", " ")}</p>
                      {row.startDate && row.dueDate && (
                        <p className="text-xs">
                          {row.startDate.toLocaleDateString()} – {row.dueDate.toLocaleDateString()}
                        </p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <div className="absolute top-3 left-2 w-2 h-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GanttChart;
