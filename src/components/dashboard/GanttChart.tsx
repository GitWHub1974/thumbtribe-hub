import { useMemo, useRef, useState } from "react";
import { JiraIssue } from "@/hooks/useJiraIssues";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

interface GanttChartProps {
  issues: JiraIssue[];
  isLoading?: boolean;
}

interface GanttRow {
  key: string;
  summary: string;
  issueType: string;
  statusCategory: "todo" | "in_progress" | "done";
  assignee: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  depth: number;
}

type ZoomLevel = "day" | "week" | "month";

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
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [zoom, setZoom] = useState<ZoomLevel>("week");
  const [isExporting, setIsExporting] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleDownloadPdf = async () => {
    if (!chartRef.current) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(chartRef.current, {
        scale: 2,
        useCORS: true,
        scrollX: 0,
        scrollY: 0,
        windowWidth: chartRef.current.scrollWidth,
        windowHeight: chartRef.current.scrollHeight,
      });
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const pdfWidth = imgWidth * 0.75;
      const pdfHeight = imgHeight * 0.75;
      const pdf = new jsPDF({
        orientation: pdfWidth > pdfHeight ? "landscape" : "portrait",
        unit: "pt",
        format: [pdfWidth, pdfHeight],
      });
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save("gantt-chart.pdf");
    } catch (e) {
      console.error("PDF export failed:", e);
    } finally {
      setIsExporting(false);
    }
  };

  // Extract unique values for filter dropdowns
  const filterOptions = useMemo(() => {
    const types = new Set<string>();
    const statuses = new Set<string>();
    const assignees = new Set<string>();
    for (const i of issues) {
      types.add(i.issueType);
      statuses.add(i.statusCategory);
      if (i.assignee) {
        const name = typeof i.assignee === "string" ? i.assignee : (i.assignee as any)?.displayName || "Unknown";
        assignees.add(name);
      }
    }
    return {
      types: Array.from(types).sort(),
      statuses: Array.from(statuses).sort(),
      assignees: Array.from(assignees).sort(),
    };
  }, [issues]);

  // Apply filters
  const filteredIssues = useMemo(() => {
    return issues.filter((i) => {
      if (filterType !== "all" && i.issueType !== filterType) return false;
      if (filterStatus !== "all" && i.statusCategory !== filterStatus) return false;
      if (filterAssignee !== "all") {
        const name = i.assignee
          ? typeof i.assignee === "string" ? i.assignee : (i.assignee as any)?.displayName || "Unknown"
          : null;
        if (name !== filterAssignee) return false;
      }
      return true;
    });
  }, [issues, filterType, filterStatus, filterAssignee]);

  const { rows, unscheduledRows, minDate, maxDate, totalDays } = useMemo(() => {
    if (!filteredIssues.length)
      return { rows: [], unscheduledRows: [], minDate: new Date(), maxDate: new Date(), totalDays: 1 };

    const epics = filteredIssues.filter((i) => i.issueType === "Epic");
    const stories = filteredIssues.filter((i) => i.issueType === "Story");
    const tasks = filteredIssues.filter((i) => i.issueType !== "Epic" && i.issueType !== "Story");

    const buildRows: GanttRow[] = [];

    const toRow = (issue: JiraIssue, depth: number): GanttRow => ({
      key: issue.key,
      summary: issue.summary,
      issueType: issue.issueType,
      statusCategory: issue.statusCategory,
      assignee: issue.assignee
        ? typeof issue.assignee === "string" ? issue.assignee : (issue.assignee as any)?.displayName || null
        : null,
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

    // Orphans
    const usedStories = new Set(buildRows.filter((r) => r.issueType === "Story").map((r) => r.key));
    const usedTasks = new Set(
      buildRows.filter((r) => r.issueType !== "Epic" && r.issueType !== "Story").map((r) => r.key)
    );
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

    const scheduled = buildRows.filter((r) => r.startDate && r.dueDate)
      .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());
    const unscheduled = buildRows.filter((r) => !r.startDate || !r.dueDate);

    const allDates = scheduled.flatMap((r) => [r.startDate, r.dueDate]).filter(Boolean) as Date[];

    if (allDates.length === 0) {
      const now = new Date();
      return {
        rows: [],
        unscheduledRows: unscheduled.length ? unscheduled : buildRows,
        minDate: now,
        maxDate: new Date(now.getTime() + 30 * 86400000),
        totalDays: 30,
      };
    }

    const min = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const max = new Date(Math.max(...allDates.map((d) => d.getTime())));
    min.setDate(min.getDate() - 3);
    max.setDate(max.getDate() + 3);
    const days = Math.max(1, Math.ceil((max.getTime() - min.getTime()) / 86400000));

    return { rows: scheduled, unscheduledRows: unscheduled, minDate: min, maxDate: max, totalDays: days };
  }, [filteredIssues]);

  const pxPerDay = zoom === "day" ? 40 : zoom === "week" ? 16 : 5;
  const chartWidth = Math.max(600, totalDays * pxPerDay);

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-8 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (issues.length === 0) {
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
    return { left: `${start * pxPerDay}px`, width: `${Math.max(duration * pxPerDay, 4)}px` };
  };

  // Time markers
  const markers: { label: string; left: number }[] = [];
  const cursor = new Date(minDate);

  if (zoom === "day") {
    cursor.setDate(cursor.getDate() + 1);
    while (cursor <= maxDate) {
      const offset = (cursor.getTime() - minDate.getTime()) / 86400000;
      markers.push({ label: cursor.toLocaleDateString("en-US", { day: "numeric", month: "short" }), left: offset * pxPerDay });
      cursor.setDate(cursor.getDate() + 1);
    }
  } else if (zoom === "week") {
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7 || 7));
    while (cursor <= maxDate) {
      const offset = (cursor.getTime() - minDate.getTime()) / 86400000;
      markers.push({ label: cursor.toLocaleDateString("en-US", { day: "numeric", month: "short" }), left: offset * pxPerDay });
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    cursor.setDate(1);
    cursor.setMonth(cursor.getMonth() + 1);
    while (cursor <= maxDate) {
      const offset = (cursor.getTime() - minDate.getTime()) / 86400000;
      markers.push({ label: cursor.toLocaleDateString("en-US", { month: "short", year: "2-digit" }), left: offset * pxPerDay });
      cursor.setMonth(cursor.getMonth() + 1);
    }
  }

  const activeFilters = [filterType, filterStatus, filterAssignee].filter((f) => f !== "all").length;

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Issue Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {filterOptions.types.map((t) => (<SelectItem key={t} value={t}>{t}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="todo">To Do</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="done">Done</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="Assignee" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            {filterOptions.assignees.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
          </SelectContent>
        </Select>

        {activeFilters > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-8" onClick={() => { setFilterType("all"); setFilterStatus("all"); setFilterAssignee("all"); }}>
            Clear filters ({activeFilters})
          </Button>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button variant="outline" size="sm" className="text-xs h-8 px-2 gap-1" onClick={handleDownloadPdf} disabled={isExporting}>
            <Download className="w-3.5 h-3.5" />
            {isExporting ? "Exporting…" : "PDF"}
          </Button>
          {(["day", "week", "month"] as ZoomLevel[]).map((level) => (
            <Button key={level} variant={zoom === level ? "default" : "outline"} size="sm" className="text-xs h-8 px-2 capitalize" onClick={() => setZoom(level)}>
              {level}
            </Button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div ref={chartRef} className="rounded-lg border border-border">
        <div className="flex">
          {/* Frozen left column */}
          <div className="w-[280px] min-w-[280px] flex-shrink-0 border-r border-border bg-background z-10">
            {/* Header spacer */}
            <div className="h-6 bg-muted border-b border-border" />
            {/* Scheduled rows */}
            {rows.map((row) => (
              <div key={row.key} className="flex items-center h-9 border-b border-border last:border-0 hover:bg-muted/30 transition-colors px-3 gap-1.5 text-xs truncate" style={{ paddingLeft: `${12 + row.depth * 16}px` }}>
                <span className="text-muted-foreground">{typeIcons[row.issueType] || "•"}</span>
                <span className="font-mono text-muted-foreground">{row.key}</span>
                <span className="truncate text-foreground">{row.summary}</span>
              </div>
            ))}
            {/* Unscheduled section */}
            {unscheduledRows.length > 0 && (
              <>
                <div className="h-8 bg-muted/60 border-t border-b border-border flex items-center px-3">
                  <span className="text-xs font-heading font-semibold text-muted-foreground">Unscheduled ({unscheduledRows.length})</span>
                </div>
                {unscheduledRows.map((row) => (
                  <div key={row.key} className="flex items-center h-9 border-b border-border last:border-0 hover:bg-muted/30 transition-colors px-3 gap-1.5 text-xs truncate" style={{ paddingLeft: `${12 + row.depth * 16}px` }}>
                    <span className="text-muted-foreground">{typeIcons[row.issueType] || "•"}</span>
                    <span className="font-mono text-muted-foreground">{row.key}</span>
                    <span className="truncate text-foreground">{row.summary}</span>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Scrollable Gantt area */}
          <div className="flex-1 overflow-x-auto">
            <div style={{ minWidth: `${chartWidth}px` }}>
              {/* Time headers */}
              <div className="relative h-6 bg-muted border-b border-border">
                {markers.map((m, i) => (
                  <span key={i} className="absolute text-[10px] text-muted-foreground font-heading top-1 whitespace-nowrap" style={{ left: `${m.left}px` }}>
                    {m.label}
                  </span>
                ))}
              </div>

              {/* Scheduled rows */}
              {rows.map((row) => {
                const barStyle = getBarStyle(row);
                return (
                  <div key={row.key} className="relative h-9 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                    {barStyle && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className={`absolute top-1.5 h-5 rounded-sm ${statusColors[row.statusCategory]} opacity-85 hover:opacity-100 transition-opacity cursor-default`} style={barStyle} />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-heading font-semibold">{row.key}: {row.summary}</p>
                          <p className="text-xs text-muted-foreground capitalize">{row.statusCategory.replace("_", " ")}</p>
                          {row.assignee && <p className="text-xs text-muted-foreground">Assignee: {row.assignee}</p>}
                          {row.startDate && row.dueDate && (
                            <p className="text-xs">{row.startDate.toLocaleDateString()} – {row.dueDate.toLocaleDateString()}</p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                );
              })}

              {/* Unscheduled section */}
              {unscheduledRows.length > 0 && (
                <>
                  <div className="h-8 bg-muted/60 border-t border-b border-border" />
                  {unscheduledRows.map((row) => (
                    <div key={row.key} className="relative h-9 border-b border-border last:border-0 hover:bg-muted/30 transition-colors flex items-center px-3">
                      <span className="text-xs text-muted-foreground italic">
                        {!row.startDate && !row.dueDate ? "No dates set" : !row.startDate ? "Missing start date" : "Missing due date"}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Showing {rows.length} scheduled + {unscheduledRows.length} unscheduled items
        {activeFilters > 0 && ` (filtered from ${issues.length} total)`}
      </div>
    </div>
  );
};

export default GanttChart;
