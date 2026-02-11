import { useMemo } from "react";
import { TempoWorklog } from "@/hooks/useTempoWorklogs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";

interface MonthlyHoursTableProps {
  worklogs: TempoWorklog[];
  isLoading?: boolean;
}

const MonthlyHoursTable = ({ worklogs, isLoading }: MonthlyHoursTableProps) => {
  const { months, pivotData, authorTotals } = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: 4 }, (_, i) => {
      const d = subMonths(now, 3 - i);
      return {
        label: format(d, "MMM yyyy"),
        start: format(startOfMonth(d), "yyyy-MM-dd"),
        end: format(endOfMonth(d), "yyyy-MM-dd"),
      };
    });

    const pivot: Record<string, Record<string, number>> = {};

    for (const w of worklogs) {
      const author = w.author && w.author !== "Unknown" ? w.author : w.assignee;
      if (!author) continue;

      for (const m of months) {
        if (w.startDate >= m.start && w.startDate <= m.end) {
          if (!pivot[author]) pivot[author] = {};
          pivot[author][m.label] = (pivot[author][m.label] || 0) + w.timeSpentSeconds;
        }
      }
    }

    const authorTotals: Record<string, number> = {};
    for (const [author, monthData] of Object.entries(pivot)) {
      authorTotals[author] = Object.values(monthData).reduce((a, b) => a + b, 0);
    }

    const sorted = Object.keys(pivot).sort((a, b) => a.localeCompare(b));
    const pivotData = sorted.map((author) => ({ author, ...pivot[author] }));

    return { months, pivotData, authorTotals };
  }, [worklogs]);

  const formatHours = (seconds: number | undefined) => {
    if (!seconds) return "—";
    const h = Math.round(seconds / 3600);
    return `${h}h`;
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
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="text-xs">Team Member</TableHead>
            {months.map((m) => (
              <TableHead key={m.label} className="text-xs text-right">
                {m.label}
              </TableHead>
            ))}
            <TableHead className="text-xs text-right">Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pivotData.map((row) => (
            <TableRow key={row.author}>
              <TableCell className="text-xs font-medium text-foreground">
                {row.author}
              </TableCell>
              {months.map((m) => (
                <TableCell key={m.label} className="text-xs text-right font-mono text-muted-foreground">
                  {formatHours(row[m.label] as number | undefined)}
                </TableCell>
              ))}
              <TableCell className="text-xs text-right font-mono font-semibold text-foreground">
                {formatHours(authorTotals[row.author])}
              </TableCell>
            </TableRow>
          ))}
          {/* Totals row */}
          <TableRow className="bg-muted/30">
            <TableCell className="text-xs font-semibold text-foreground">Total</TableCell>
            {months.map((m) => {
              const colTotal = pivotData.reduce(
                (s, r) => s + ((r[m.label] as number) || 0),
                0
              );
              return (
                <TableCell key={m.label} className="text-xs text-right font-mono font-semibold text-foreground">
                  {formatHours(colTotal)}
                </TableCell>
              );
            })}
            <TableCell className="text-xs text-right font-mono font-semibold text-foreground">
              {formatHours(
                Object.values(authorTotals).reduce((a, b) => a + b, 0)
              )}
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
};

export default MonthlyHoursTable;
