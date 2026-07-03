"use client";

import { useWorkers } from "../hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { stationConfig } from "../station-style";
import type { Worker, Station } from "../types";

type Align = "left" | "center" | "right";
const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

function StationBadge({ station }: { station: Station }) {
  const cfg = stationConfig[station];
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-foreground/80">
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

interface Column {
  key: string;
  header: string;
  align: Align;
  width?: string;
  cell: (w: Worker) => React.ReactNode;
}

const columns: Column[] = [
  {
    key: "name",
    header: "Name",
    align: "left",
    cell: (w) => <span className="font-medium">{w.name}</span>,
  },
  {
    key: "station",
    header: "Station",
    align: "left",
    width: "w-[140px]",
    cell: (w) => <StationBadge station={w.station} />,
  },
  {
    key: "status",
    header: "Status",
    align: "center",
    width: "w-[110px]",
    cell: (w) => (
      <Badge
        variant="outline"
        className={cn(
          "font-mono text-[10px] uppercase",
          w.is_active
            ? "text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
            : "text-muted-foreground",
        )}
      >
        {w.is_active ? "Active" : "Inactive"}
      </Badge>
    ),
  },
  {
    key: "last_login",
    header: "Last login",
    align: "right",
    width: "w-[140px]",
    cell: (w) => (
      <span className="font-mono text-[11px] text-muted-foreground">
        {w.last_login_at ? new Date(w.last_login_at).toLocaleDateString() : "—"}
      </span>
    ),
  },
];

export function WorkerList() {
  const { data: workers, isLoading, error } = useWorkers();

  if (isLoading)
    return (
      <p className="font-mono text-sm text-muted-foreground">
        Loading workers…
      </p>
    );
  if (error)
    return (
      <p className="font-mono text-sm text-destructive">
        Failed to load workers.
      </p>
    );
  if (!workers?.length)
    return (
      <Card className="p-12 text-center text-muted-foreground text-sm">
        No workers yet. Add your first one.
      </Card>
    );

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-11 px-4 font-mono text-[10px] uppercase tracking-wider",
                  alignClass[col.align],
                  col.width,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((w) => (
            <TableRow key={w.id}>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn("px-4 py-4", alignClass[col.align])}
                >
                  {col.cell(w)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
