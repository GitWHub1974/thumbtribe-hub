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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface TimeTrackingTableProps {
  worklogs: TempoWorklog[];
  isLoading?: boolean;
}

type GroupBy = "none" | "epic" | "assignee";
type SortField = "issueKey" | "author" | "timeSpentSeconds" | "startDate";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 25;

const formatHours = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const TimeTrackingTable = ({ worklogs, isLoading }: TimeTrackingTableProps) => {
  const [groupBy, setGroupBy] = useState<GroupBy>("none");
  const [searchQuery, setSearchQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortField, setSortField] = useState<SortField>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(0);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
    setPage(0);
  };

  // Filter worklogs
  const filtered = useMemo(() => {
    let result = worklogs;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (w) =>
          w.issueKey.toLowerCase().includes(q) ||
          w.issueSummary.toLowerCase().includes(q) ||
          w.author.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      result = result.filter((w) => w.startDate >= dateFrom);
    }
    if (dateTo) {
      result = result.filter((w) => w.startDate <= dateTo);
    }

    return result;
  }, [worklogs, searchQuery, dateFrom, dateTo]);

  // Sort worklogs
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "issueKey":
          cmp = a.issueKey.localeCompare(b.issueKey);
          break;
        case "author":
          cmp = a.author.localeCompare(b.author);
          break;
        case "timeSpentSeconds":
          cmp = a.timeSpentSeconds - b.timeSpentSeconds;
          break;
        case "startDate":
          cmp = a.startDate.localeCompare(b.startDate);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Group
  const grouped = useMemo(() => {
    if (groupBy === "none") return { "All Worklogs": sorted };

    const map: Record<string, TempoWorklog[]> = {};
    for (const w of sorted) {
      const key =
        groupBy === "assignee"
          ? w.author || "Unassigned"
          : w.issueKey.split("-")[0] || "Other";
      if (!map[key]) map[key] = [];
      map[key].push(w);
    }
    return map;
  }, [sorted, groupBy]);

  // Pagination (only in ungrouped mode)
  const totalPages = groupBy === "none" ? Math.max(1, Math.ceil(sorted.length / PAGE_SIZE)) : 1;
  const paginatedGrouped = useMemo(() => {
    if (groupBy !== "none") return grouped;
    const start = page * PAGE_SIZE;
    return { "All Worklogs": sorted.slice(start, start + PAGE_SIZE) };
  }, [grouped, groupBy, page, sorted]);

  // Grand total
  const grandTotalSeconds = filtered.reduce((s, w) => s + w.timeSpentSeconds, 0);

  const exportCSV = () => {
    const header = "Issue Key,Issue Summary,Author,Hours,Date,Description\n";
    const rows = filtered.map((w) =>
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

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors"
      onClick={() => toggleSort(field)}
    >
      {children}
      <ArrowUpDown className={`w-3 h-3 ${sortField === field ? "text-foreground" : "text-muted-foreground/50"}`} />
    </button>
  );

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
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search issue key, summary, or author..."
          value={searchQuery}
          onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
          className="w-64 h-8 text-xs"
        />

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">From:</span>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
            className="w-36 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">To:</span>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
            className="w-36 h-8 text-xs"
          />
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Group:</span>
          <Select value={groupBy} onValueChange={(v) => { setGroupBy(v as GroupBy); setPage(0); }}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="epic">Issue Prefix</SelectItem>
              <SelectItem value="assignee">Assignee</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Tables */}
      {Object.entries(paginatedGrouped).map(([group, logs]) => {
        const groupTotalSeconds = logs.reduce((s, w) => s + w.timeSpentSeconds, 0);
        return (
          <div key={group}>
            {groupBy !== "none" && (
              <div className="flex items-center justify-between px-1 py-2">
                <h3 className="text-sm font-heading font-semibold text-foreground">{group}</h3>
                <span className="text-xs text-muted-foreground font-mono">{formatHours(groupTotalSeconds)}</span>
              </div>
            )}
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">
                      <SortButton field="issueKey">Issue</SortButton>
                    </TableHead>
                    <TableHead className="text-xs">
                      <SortButton field="author">Author</SortButton>
                    </TableHead>
                    <TableHead className="text-xs text-right">
                      <SortButton field="timeSpentSeconds">Hours</SortButton>
                    </TableHead>
                    <TableHead className="text-xs">
                      <SortButton field="startDate">Date</SortButton>
                    </TableHead>
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

      {/* Footer: totals + pagination */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="font-mono">
          Total: <span className="text-foreground font-semibold">{formatHours(grandTotalSeconds)}</span>
          {" "}across {filtered.length} worklog{filtered.length !== 1 ? "s" : ""}
          {filtered.length !== worklogs.length && ` (filtered from ${worklogs.length})`}
        </div>

        {groupBy === "none" && totalPages > 1 && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span>
              Page {page + 1} of {totalPages}
            </span>
            <Button variant="outline" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TimeTrackingTable;
