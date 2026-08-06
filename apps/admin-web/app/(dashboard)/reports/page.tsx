"use client";

import { useState } from "react";
import { useWorkerReport } from "@/features/reports/hooks";
import {
  RangePicker,
  presetRanges,
  DateRange,
} from "@/features/reports/components/range-picker";
import { WorkerReportTable } from "@/features/reports/components/worker-report-table";
import { Card } from "@/components/ui/card";

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(presetRanges()[1]); // Last 7 days
  const { data, isLoading, error } = useWorkerReport(range.from, range.to);

  const totalPieces = data?.workers.reduce((s, w) => s + w.pieces_done, 0) ?? 0;
  const totalBatches =
    data?.workers.reduce((s, w) => s + w.batches_done, 0) ?? 0;
  const activeNow =
    data?.workers.filter((w) => w.currently_working).length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Worker productivity by date range.
        </p>
      </div>

      <RangePicker value={range} onChange={setRange} />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 max-w-xl">
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Pieces
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {totalPieces}
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Phase runs
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {totalBatches}
          </div>
        </Card>
        <Card className="p-4">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            On floor now
          </div>
          <div className="text-2xl font-bold tabular-nums mt-1">
            {activeNow}
          </div>
        </Card>
      </div>

      {isLoading ? (
        <p className="font-mono text-sm text-muted-foreground">
          Loading report…
        </p>
      ) : error ? (
        <p className="font-mono text-sm text-destructive">
          Failed to load report.
        </p>
      ) : (
        <WorkerReportTable workers={data?.workers ?? []} />
      )}
    </div>
  );
}
