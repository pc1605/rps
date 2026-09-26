"use client";

import { Trophy, Users } from "lucide-react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { stationTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { WorkerProductivity } from "../types";

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
  loading,
}: {
  workers: WorkerProductivity[];
  loading?: boolean;
}) {
  const topPieces = Math.max(0, ...workers.map((w) => w.pieces_done));

  const columns: Column<WorkerProductivity>[] = [
    {
      key: "worker",
      header: "Worker",
      card: "title",
      cell: (w) => (
        <span
          className={cn(
            "inline-flex items-center gap-2 font-medium",
            !w.is_active && "text-muted-foreground line-through",
          )}
        >
          {w.worker_name}
          {w.pieces_done > 0 && w.pieces_done === topPieces && (
            <Trophy className="h-3.5 w-3.5 text-brand" aria-label="Top producer" />
          )}
        </span>
      ),
    },
    {
      key: "station",
      header: "Station",
      cell: (w) => <Chip tone={stationTone[w.station as keyof typeof stationTone]}>{w.station}</Chip>,
    },
    {
      key: "batches",
      header: "Batches",
      align: "right",
      cell: (w) => <span className="tabular">{w.batches_done}</span>,
    },
    {
      key: "pieces",
      header: "Pieces",
      align: "right",
      cell: (w) => <span className="tabular font-semibold">{w.pieces_done}</span>,
    },
    {
      key: "avg",
      header: "Avg / batch",
      align: "right",
      cell: (w) => <span className="tabular text-muted-foreground">{fmtDuration(w.avg_duration_secs)}</span>,
    },
    {
      key: "now",
      header: "Now",
      align: "center",
      cell: (w) =>
        w.currently_working ? (
          <span className="inline-flex items-center gap-1.5 text-caption text-working">
            <span className="h-2 w-2 animate-pulse rounded-full bg-working" aria-hidden />
            working
          </span>
        ) : null,
    },
  ];

  return (
    <DataTable
      rows={workers}
      columns={columns}
      rowKey={(w) => w.worker_id}
      loading={loading}
      empty={
        <EmptyState
          icon={Users}
          title="No workers yet"
          body="Add workers from the Workers page; their output appears here as they work."
        />
      }
    />
  );
}
