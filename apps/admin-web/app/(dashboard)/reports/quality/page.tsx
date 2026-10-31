"use client";

import {
  REWORK_REASON_LABEL,
  type ReasonCount,
  type ReworkReason,
  SHORT_REASON_LABEL,
  type ShortReason,
} from "@rps/shared";
import { DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { WorkerLink } from "@/components/rps/entity-link";
import { SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Card } from "@/components/ui/card";
import { CsvButton } from "@/features/reports/components/csv-button";
import { useReportChrome } from "@/features/reports/components/report-header";
import { useQuality } from "@/features/reports/hooks";
import { fmtHours, pct } from "@/features/reports/lib/format";

const reworkLabel = (r: string) => REWORK_REASON_LABEL[r as ReworkReason] ?? r;
const shortLabel = (r: string) =>
  r === "unknown" ? "Not recorded" : (SHORT_REASON_LABEL[r as ShortReason] ?? r);
const ACTION_LABEL: Record<string, string> = { split: "Split", reduce: "Reduce", recut: "Re-cut" };

/** Ranked horizontal bars — one series, length = count. */
function ReasonBars({
  rows,
  label,
  empty,
}: {
  rows: ReasonCount[];
  label: (r: string) => string;
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="text-small text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.reason} className="grid grid-cols-[9rem_1fr_3rem] items-center gap-3 text-small">
          <span className="truncate">{label(r.reason)}</span>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-foreground/70"
              style={{ width: `${(r.count / max) * 100}%` }}
            />
          </div>
          <span className="tabular text-right">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

export default function ReportsQualityPage() {
  const { range, chrome } = useReportChrome("Rework, short cuts and losses.");
  const { data: q, isPending, isError } = useQuality(range.from, range.to);
  const shortTotal = q?.short_cuts.reduce((n, s) => n + s.count, 0) ?? 0;
  const losses = q?.losses ?? [];
  const writeOffs = losses.filter((l) => l.decision === "write_off").reduce((n, l) => n + l.count, 0);
  const recuts = losses.filter((l) => l.decision === "recut").reduce((n, l) => n + l.count, 0);
  const v = (n: number | string | undefined) => (isPending || n === undefined ? "–" : n);

  return (
    <div className="space-y-6">
      {chrome}
      {isError ? (
        <EmptyState
          title="Couldn't load the report"
          body="Check the backend is running, then try another range."
        />
      ) : (
        <>
          <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
            <Stat size="sm" value={v(q?.rework_rounds)} label="Rework rounds" />
            <Stat
              size="sm"
              value={v(q?.avg_fix_hours != null ? fmtHours(q.avg_fix_hours) : "—")}
              label="Average fix time"
            />
            <Stat
              size="sm"
              value={v(shortTotal)}
              of={q ? q.cut_completions : undefined}
              label={`Short cuts / cuts${q?.cut_completions ? ` (${pct(shortTotal, q.cut_completions)})` : ""}`}
            />
            <Stat
              size="sm"
              value={v(writeOffs)}
              label="Written off"
              tone={writeOffs ? "text-danger" : undefined}
            />
            <Stat size="sm" value={v(recuts)} label="Re-cut" />
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <SectionTitle>Rework by reason</SectionTitle>
              <Card className="p-4">
                <ReasonBars rows={q?.by_reason ?? []} label={reworkLabel} empty="No rework in this range." />
              </Card>
            </section>
            <section className="space-y-3">
              <SectionTitle>Losses by reason</SectionTitle>
              <Card className="p-4">
                <ReasonBars
                  rows={q?.loss_by_reason ?? []}
                  label={reworkLabel}
                  empty="No write-offs or re-cuts in this range."
                />
              </Card>
            </section>
          </div>

          <section className="space-y-3">
            <SectionTitle
              aside={
                <CsvButton
                  filename={`rework-by-stitcher-${range.from}-${range.to}.csv`}
                  rows={q?.by_stitcher ?? []}
                  cols={[
                    { header: "Stitcher", value: (r) => r.worker_name },
                    { header: "Mats stitched", value: (r) => r.stitched },
                    { header: "Rework rounds", value: (r) => r.rounds },
                  ]}
                />
              }
            >
              Rework by stitcher
            </SectionTitle>
            <DataTable
              rows={q?.by_stitcher ?? []}
              rowKey={(r) => r.worker_id}
              rowHref={(r) => `/workers/${r.worker_id}`}
              loading={isPending}
              empty={<EmptyState title="No stitching in this range" />}
              columns={[
                {
                  key: "name",
                  header: "Stitcher",
                  card: "title",
                  cell: (r) => <WorkerLink id={r.worker_id} name={r.worker_name} className="font-medium" />,
                },
                {
                  key: "stitched",
                  header: "Stitched",
                  align: "right",
                  cell: (r) => <span className="tabular">{r.stitched}</span>,
                },
                {
                  key: "rounds",
                  header: "Rework rounds",
                  align: "right",
                  cell: (r) => <span className="tabular">{r.rounds}</span>,
                },
                {
                  key: "rate",
                  header: "Rate",
                  align: "right",
                  cell: (r) => (
                    <span className="tabular">{r.stitched ? pct(r.rounds, r.stitched) : "—"}</span>
                  ),
                },
              ]}
            />
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="space-y-3">
              <SectionTitle
                aside={
                  <CsvButton
                    filename={`short-cuts-${range.from}-${range.to}.csv`}
                    rows={q?.short_cuts ?? []}
                    cols={[
                      { header: "Action", value: (s) => ACTION_LABEL[s.action] ?? s.action },
                      { header: "Reason", value: (s) => shortLabel(s.reason) },
                      { header: "Count", value: (s) => s.count },
                    ]}
                  />
                }
              >
                Short cuts
              </SectionTitle>
              <DataTable
                rows={q?.short_cuts ?? []}
                rowKey={(s) => `${s.action}-${s.reason}`}
                loading={isPending}
                empty={<EmptyState title="No short cuts in this range" />}
                columns={[
                  {
                    key: "action",
                    header: "Action",
                    card: "title",
                    cell: (s) => ACTION_LABEL[s.action] ?? s.action,
                  },
                  { key: "reason", header: "Reason", cell: (s) => shortLabel(s.reason) },
                  {
                    key: "n",
                    header: "Count",
                    align: "right",
                    cell: (s) => <span className="tabular">{s.count}</span>,
                  },
                ]}
              />
            </section>
            <section className="space-y-3">
              <SectionTitle
                aside={
                  <CsvButton
                    filename={`losses-${range.from}-${range.to}.csv`}
                    rows={losses}
                    cols={[
                      { header: "Car", value: (l) => l.car_name },
                      {
                        header: "Decision",
                        value: (l) => (l.decision === "write_off" ? "Write-off" : "Re-cut"),
                      },
                      { header: "Mats", value: (l) => l.count },
                    ]}
                  />
                }
              >
                Write-offs & re-cuts by item
              </SectionTitle>
              <DataTable
                rows={losses}
                rowKey={(l) => `${l.decision}-${l.car_model_id}`}
                rowHref={(l) => `/cars/${l.car_model_id}`}
                loading={isPending}
                empty={<EmptyState title="No losses in this range" />}
                columns={[
                  {
                    key: "car",
                    header: "Car",
                    card: "title",
                    cell: (l) => <span className="font-medium">{l.car_name}</span>,
                  },
                  {
                    key: "decision",
                    header: "Decision",
                    cell: (l) => (l.decision === "write_off" ? "Write-off" : "Re-cut"),
                  },
                  {
                    key: "n",
                    header: "Mats",
                    align: "right",
                    cell: (l) => <span className="tabular">{l.count}</span>,
                  },
                ]}
              />
            </section>
          </div>
          <p className="text-caption text-muted-foreground">
            Short cuts resolved before reasons were required show as "Not recorded".
          </p>
        </>
      )}
    </div>
  );
}
