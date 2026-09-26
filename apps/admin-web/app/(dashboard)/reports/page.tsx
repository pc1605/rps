"use client";

import { useState } from "react";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Card } from "@/components/ui/card";
import { type DateRange, defaultRange, RangePicker } from "@/features/reports/components/range-picker";
import { WorkerReportTable } from "@/features/reports/components/worker-report-table";
import { useWorkerReport } from "@/features/reports/hooks";

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, isPending, isError } = useWorkerReport(range.from, range.to);

  const workers = data?.workers ?? [];
  const totalPieces = workers.reduce((s, w) => s + w.pieces_done, 0);
  const totalRuns = workers.reduce((s, w) => s + w.batches_done, 0);
  const activeNow = workers.filter((w) => w.currently_working).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Reports" description="Worker output for any date range." />

      <RangePicker value={range} onChange={setRange} />

      <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
        <Stat size="sm" value={isPending ? "–" : totalPieces} label="Pieces" />
        <Stat size="sm" value={isPending ? "–" : totalRuns} label="Phase runs" />
        <Stat
          size="sm"
          value={isPending ? "–" : activeNow}
          label="On the floor now"
          tone={activeNow ? "text-working" : undefined}
        />
      </Card>

      {isError ? (
        <EmptyState
          title="Couldn't load the report"
          body="Check the backend is running, then try another range."
        />
      ) : (
        <WorkerReportTable workers={workers} loading={isPending} />
      )}
    </div>
  );
}
