"use client";

import { STATION_LABEL, type Station, type WorkerOutputRow } from "@rps/shared";
import { DataTable, type Column } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { WorkerLink } from "@/components/rps/entity-link";
import { SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Card } from "@/components/ui/card";
import { CsvButton } from "@/features/reports/components/csv-button";
import { useReportChrome } from "@/features/reports/components/report-header";
import { useWorkerOutput } from "@/features/reports/hooks";
import { fmtActive, pct } from "@/features/reports/lib/format";

const UNIT: Record<Station, string> = {
  cutter: "pieces cut",
  stitcher: "mats stitched",
  packer: "mats packed",
};
const STATIONS: Station[] = ["cutter", "stitcher", "packer"];

function columns(station: Station): Column<WorkerOutputRow>[] {
  const cols: Column<WorkerOutputRow>[] = [
    {
      key: "name",
      header: "Worker",
      card: "title",
      cell: (w) => (
        <span className="font-medium">
          <WorkerLink id={w.worker_id} name={w.worker_name} />
          {!w.is_active && <span className="ml-2 text-caption text-muted-foreground">inactive</span>}
          {w.currently_open > 0 && <span className="ml-2 text-caption text-working">on the floor</span>}
        </span>
      ),
    },
    {
      key: "mats",
      header: station === "cutter" ? "Pieces" : "Mats",
      align: "right",
      cell: (w) => <span className="tabular">{w.mats}</span>,
    },
    {
      key: "days",
      header: "Days",
      align: "right",
      cell: (w) => <span className="tabular">{w.days_worked}</span>,
    },
    {
      key: "active",
      header: station === "cutter" ? "Cutting time" : "Active time",
      align: "right",
      cell: (w) => <span className="tabular text-muted-foreground">{fmtActive(w.active_secs)}</span>,
    },
    {
      key: "rate",
      header: "Per hour",
      align: "right",
      cell: (w) => (
        <span className="tabular">{w.mats_per_hour ?? <span className="text-muted-foreground">—</span>}</span>
      ),
    },
  ];
  if (station === "stitcher")
    cols.push(
      {
        key: "rework",
        header: "Rework rate",
        align: "right",
        cell: (w) => (
          <span className="tabular">
            {w.mats ? pct(w.rework_rounds, w.mats) : "—"}{" "}
            <span className="text-muted-foreground">({w.rework_rounds})</span>
          </span>
        ),
      },
      {
        key: "quota",
        header: "Quota delivered",
        align: "right",
        cell: (w) =>
          w.quota_target ? (
            <span className="tabular">
              {w.quota_done} / {w.quota_target}{" "}
              <span className="text-muted-foreground">
                · {w.quota_batches} batch{w.quota_batches === 1 ? "" : "es"}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
    );
  return cols;
}

export default function ReportsWorkersPage() {
  const { range, chrome } = useReportChrome("Output, pace, rework and quotas per worker.");
  const { data, isPending, isError, error } = useWorkerOutput(range.from, range.to);
  const workers = data?.workers ?? [];

  return (
    <div className="space-y-6">
      {chrome}
      {isError ? (
        <EmptyState
          title="Couldn't load the report"
          body={error?.message ?? "Check the backend is running, then try another range."}
        />
      ) : (
        <>
          <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
            {STATIONS.map((s) => (
              <Stat
                key={s}
                size="sm"
                value={
                  isPending ? "–" : workers.filter((w) => w.station === s).reduce((n, w) => n + w.mats, 0)
                }
                label={UNIT[s].charAt(0).toUpperCase() + UNIT[s].slice(1)}
              />
            ))}
            <Stat
              size="sm"
              value={isPending ? "–" : workers.filter((w) => w.currently_open > 0).length}
              label="On the floor now"
              tone={workers.some((w) => w.currently_open > 0) ? "text-working" : undefined}
            />
          </Card>

          {STATIONS.map((s) => {
            const rows = workers.filter((w) => w.station === s && (w.mats > 0 || w.is_active));
            return (
              <section key={s} className="space-y-3">
                <SectionTitle
                  aside={
                    <CsvButton
                      filename={`${s}s-${range.from}-${range.to}.csv`}
                      rows={rows}
                      cols={[
                        { header: "Worker", value: (w) => w.worker_name },
                        { header: s === "cutter" ? "Pieces" : "Mats", value: (w) => w.mats },
                        { header: "Days worked", value: (w) => w.days_worked },
                        { header: "Active hours", value: (w) => (w.active_secs / 3600).toFixed(1) },
                        { header: "Per hour", value: (w) => w.mats_per_hour },
                        ...(s === "stitcher"
                          ? [
                              { header: "Rework rounds", value: (w: WorkerOutputRow) => w.rework_rounds },
                              { header: "Quota done", value: (w: WorkerOutputRow) => w.quota_done },
                              { header: "Quota target", value: (w: WorkerOutputRow) => w.quota_target },
                            ]
                          : []),
                      ]}
                    />
                  }
                >
                  {STATION_LABEL[s]}s
                </SectionTitle>
                <DataTable
                  rows={rows}
                  columns={columns(s)}
                  rowKey={(w) => w.worker_id}
                  rowHref={(w) => `/workers/${w.worker_id}`}
                  loading={isPending}
                  empty={
                    <EmptyState title={`No ${STATION_LABEL[s].toLowerCase()}s with output in this range`} />
                  }
                />
              </section>
            );
          })}
          <p className="text-caption text-muted-foreground">
            Active time is first to last scan of each day (cutters: start to complete), so breaks count as
            active. Per hour shows once a worker has at least 15 minutes. Rework rate = rework rounds on mats
            they stitched ÷ mats stitched. Quotas count batches whose stitching finished in this range.
          </p>
        </>
      )}
    </div>
  );
}
