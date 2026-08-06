"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkerProductivity } from "../types";

const stationStyle: Record<string, string> = {
  cutter: "text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  stitcher: "text-pink-600 dark:text-pink-400 border-pink-500/30",
  packer: "text-amber-600 dark:text-amber-400 border-amber-500/30",
};

function fmtDuration(s: number) {
  if (s <= 0) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function WorkerReportTable({
  workers,
}: {
  workers: WorkerProductivity[];
}) {
  if (!workers.length)
    return (
      <Card className="p-12 text-center text-muted-foreground text-sm">
        No workers found.
      </Card>
    );

  const topPieces = Math.max(...workers.map((w) => w.pieces_done));

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider">
              Worker
            </TableHead>
            <TableHead className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider">
              Station
            </TableHead>
            <TableHead className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider text-right">
              Batches
            </TableHead>
            <TableHead className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider text-right">
              Pieces
            </TableHead>
            <TableHead className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider text-right">
              Avg / batch
            </TableHead>
            <TableHead className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider text-center">
              Now
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {workers.map((w) => {
            const isTop = w.pieces_done > 0 && w.pieces_done === topPieces;
            return (
              <TableRow
                key={w.worker_id}
                className={cn(!w.is_active && "opacity-50")}
              >
                <TableCell className="px-4 py-4 font-medium">
                  <span className="inline-flex items-center gap-2">
                    {w.worker_name}
                    {isTop && <Trophy className="h-3.5 w-3.5 text-amber-500" />}
                  </span>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Badge
                    variant="outline"
                    className={cn(
                      "font-mono text-[10px] uppercase",
                      stationStyle[w.station],
                    )}
                  >
                    {w.station}
                  </Badge>
                </TableCell>
                <TableCell className="px-4 py-4 text-right font-mono tabular-nums">
                  {w.batches_done}
                </TableCell>
                <TableCell className="px-4 py-4 text-right font-mono tabular-nums font-semibold">
                  {w.pieces_done}
                </TableCell>
                <TableCell className="px-4 py-4 text-right font-mono tabular-nums text-muted-foreground">
                  {fmtDuration(w.avg_duration_secs)}
                </TableCell>
                <TableCell className="px-4 py-4 text-center">
                  {w.currently_working && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      working
                    </span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
