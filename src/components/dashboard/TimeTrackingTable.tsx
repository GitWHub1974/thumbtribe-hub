import { useMemo, useState } from "react";
import { TempoWorklog } from "@/hooks/useTempoWorklogs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download } from "lucide-react";

interface TimeTrackingTableProps {
  worklogs: TempoWorklog[];
  isLoading?: boolean;
}

type GroupBy = "none" | "epic" | "assignee";

const formatHours = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const TimeTrackingTable = ({ worklogs, isLoading }: TimeTrackingTableProps) => {
  const [groupBy, setGroupBy] = useState<GroupBy>("none");

  const grouped = useMemo(() => {
    if (groupBy === "none") return { "All Worklogs": worklogs };

    const map: Record<string, TempoWorklog[]> = {};
    for (const w of worklogs) {
      const key = groupBy === "assignee" ? (w.author || "Unassigned") : (w.issueKey.split("-")[0] || "Other");
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }
    return map;
  }, [worklogs, groupBy]);

  const exportCSV = () => {
    const header = "Issue Key,Issue Summary,Author,Hours,Date,Description\n";
    const rows = worklogs.map((w) =>
      [
        w.issueKey,
        `"${w.issueSummary.replace(/"/g, '""')}"`,
        w.author,
        (w.timeSpentSeconds / 3600).toFixed(2),
        w.startDate,
        `"${(w.description || "").replace(/"/g, '""')}"`,
      ].join(",")
    );
    const blob = new Blob([header + rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `worklogs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-muted animate-pulse rounded" />
        ))}
      </div>
    );
  }

  if (worklogs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No worklogs found for this project.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">Group by:</span>
          <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
            <SelectTrigger className="w-36 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="epic">Issue Prefix</SelectItem>
              <SelectItem value="assignee">Assignee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={exportCSV}>
          <Download className="w-4 h-4 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {Object.entries(grouped).map(([group, logs]) => {
        const totalSeconds = logs.reduce((s, w) => s + w.timeSpentSeconds, 0);
        return (
          <div key={group}>
            {groupBy !== "none" && (
              <div className="flex items-center justify-between px-1 py-2">
                <h3 className="text-sm font-heading font-semibold text-foreground">{group}</h3>
                <span className="text-xs text-muted-foreground font-mono">{formatHours(totalSeconds)}</span>
              </div>
            )}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Issue</TableHead>
                    <TableHead className="text-xs">Author</TableHead>
                    <TableHead className="text-xs text-right">Hours</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((w, i) => (
                    <TableRow key={`${w.issueKey}-${w.startDate}-${i}`}>
                      <TableCell className="text-xs">
                        <span className="font-mono text-muted-foreground mr-1.5">{w.issueKey}</span>
                        <span className="text-foreground">{w.issueSummary}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.author}</TableCell>
                      <TableCell className="text-xs text-right font-mono">{formatHours(w.timeSpentSeconds)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{w.startDate}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {w.description || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TimeTrackingTable;
