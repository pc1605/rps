"use client";

import { REPORT_STAGE_LABEL, type ReportStage, type StuckBatch } from "@rps/shared";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { BatchLink } from "@/components/rps/entity-link";
import { EmptyState } from "@/components/rps/empty-state";
import { DataTable, type Column } from "@/components/rps/data-table";
import { SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CsvButton } from "@/features/reports/components/csv-button";
import { DayBars } from "@/features/reports/components/day-bars";
import { useReportChrome } from "@/features/reports/components/report-header";
import { ThresholdsDialog } from "@/features/reports/components/thresholds-dialog";
import { useOverview, useStuck } from "@/features/reports/hooks";
import { delta, fmtHours, pct } from "@/features/reports/lib/format";
import { cn } from "@/lib/utils";

const STAGE_VIEW: Record<ReportStage, string> = {
  cutting: "cutting",
  awaiting_assignment: "ready",
  stitching: "stitching",
  packing: "packing",
};
const AGE_BUCKETS = ["< 4 h", "4–24 h", "1–3 d", "> 3 d"];

const stuckColumns: Column<StuckBatch>[] = [
  {
    key: "batch",
    header: "Batch",
    card: "title",
    cell: (b) => (
      <span>
        <BatchLink id={b.batch_id} code={b.batch_code} />{" "}
        <span className="text-muted-foreground">{b.car_name}</span>
      </span>
    ),
  },
  { key: "mats", header: "Mats", align: "right", cell: (b) => <span className="tabular">{b.quantity}</span> },
  { key: "stage", header: "Stage", cell: (b) => REPORT_STAGE_LABEL[b.stage] },
  {
    key: "idle",
    header: "Idle for",
    align: "right",
    cell: (b) => (
      <span className="tabular text-danger">
        {fmtHours(b.idle_hours)} <span className="text-muted-foreground">/ {b.threshold_hours} h</span>
      </span>
    ),
  },
  {
    key: "in",
    header: "In stage since",
    align: "right",
    cell: (b) => (
      <span className="tabular text-muted-foreground">
        {new Date(b.entered_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </span>
    ),
  },
];

export default function ReportsOverviewPage() {
  const { range, chrome } = useReportChrome(
    "Throughput, work in progress, stuck batches and yield.",
    <ThresholdsDialog />,
  );
  const { data, isPending, isError, error } = useOverview(range.from, range.to);
  const { data: stuck, isPending: stuckPending } = useStuck();

  if (isError)
    return (
      <div className="space-y-6">
        {chrome}
        <EmptyState
          title="Couldn't load the overview"
          body={error?.message ?? "Check the backend is running, then try another range."}
        />
      </div>
    );

  const t = data?.totals;
  const p = data?.previous;
  const days = data?.days ?? [];
  const fpy = data ? pct(data.fpy_first_pass, data.fpy_packed) : "–";

  return (
    <div className="space-y-6">
      {chrome}

      <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
        {(
          [
            ["packed", "Mats packed"],
            ["stitched", "Mats stitched"],
            ["cut", "Pieces cut"],
          ] as const
        ).map(([k, label]) => (
          <div key={k}>
            <Stat size="sm" value={t ? t[k] : "–"} label={label} />
            {t && p && delta(t[k], p[k]) && (
              <div className="mt-0.5 text-caption text-muted-foreground">
                {delta(t[k], p[k])} vs previous {days.length} days
              </div>
            )}
          </div>
        ))}
        <Stat size="sm" value={fpy} label="First-pass yield" />
        <Stat
          size="sm"
          value={data ? data.stuck_count : "–"}
          label="Stuck now"
          tone={data?.stuck_count ? "text-danger" : undefined}
        />
      </Card>

      <section className="space-y-3">
        <SectionTitle>Throughput per day</SectionTitle>
        {isPending ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <Card className="grid gap-6 p-5 md:grid-cols-3">
            <DayBars
              title="Cut"
              unit="pieces"
              barClass="bg-phase-cutting"
              days={days.map((d) => ({ day: d.day, value: d.cut }))}
            />
            <DayBars
              title="Stitched"
              unit="mats"
              barClass="bg-phase-stitching"
              days={days.map((d) => ({ day: d.day, value: d.stitched }))}
            />
            <DayBars
              title="Packed"
              unit="mats"
              barClass="bg-phase-packing"
              days={days.map((d) => ({ day: d.day, value: d.packed }))}
            />
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Work in progress — right now</SectionTitle>
        {isPending || !data ? (
          <Skeleton className="h-28 w-full" />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {data.wip.map((w) => (
              <Link key={w.stage} href={`/batches?view=${STAGE_VIEW[w.stage]}`} className="group">
                <Card className="h-full space-y-3 p-4 group-hover:bg-accent">
                  <div className="flex items-center justify-between">
                    <span className="text-small font-medium">{REPORT_STAGE_LABEL[w.stage]}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                  </div>
                  <div className="tabular text-small">
                    <span className="text-h2 font-semibold">{w.batches}</span>{" "}
                    <span className="text-muted-foreground">
                      batch{w.batches === 1 ? "" : "es"} · {w.mats} mats
                    </span>
                  </div>
                  <dl className="grid grid-cols-4 gap-[2px] text-center">
                    {w.ageing.map((n, i) => (
                      <div key={AGE_BUCKETS[i]} className="rounded-sm bg-muted px-1 py-1.5">
                        <dt className="text-caption text-muted-foreground">{AGE_BUCKETS[i]}</dt>
                        <dd
                          className={cn("tabular text-small", n > 0 && i === 3 && "font-medium text-danger")}
                        >
                          {n}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {w.stuck > 0 && <div className="text-caption text-danger">{w.stuck} stuck</div>}
                </Card>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3" id="stuck">
        <SectionTitle
          aside={
            <CsvButton
              filename="stuck-batches.csv"
              rows={stuck ?? []}
              cols={[
                { header: "Batch", value: (b) => b.batch_code },
                { header: "Car", value: (b) => b.car_name },
                { header: "Mats", value: (b) => b.quantity },
                { header: "Stage", value: (b) => REPORT_STAGE_LABEL[b.stage] },
                { header: "Idle hours", value: (b) => b.idle_hours.toFixed(1) },
                { header: "Threshold hours", value: (b) => b.threshold_hours },
                { header: "In stage since", value: (b) => b.entered_at },
                { header: "Last activity", value: (b) => b.last_activity_at },
              ]}
            />
          }
        >
          Stuck batches
        </SectionTitle>
        <DataTable
          rows={stuck ?? []}
          columns={stuckColumns}
          rowKey={(b) => b.batch_id}
          rowHref={(b) => `/batches/${b.batch_id}`}
          loading={stuckPending}
          empty={
            <EmptyState
              title="Nothing is stuck"
              body="Every live batch moved within its stage's threshold."
            />
          }
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-3">
          <SectionTitle>First-pass yield by week</SectionTitle>
          <Card className="space-y-2 p-4">
            {!data?.fpy_weeks.length ? (
              <p className="text-small text-muted-foreground">Nothing packed in this range.</p>
            ) : (
              data.fpy_weeks.map((w) => {
                const share = w.packed ? w.first_pass / w.packed : 0;
                return (
                  <div key={w.week} className="grid grid-cols-[6rem_1fr_7rem] items-center gap-3 text-small">
                    <span className="text-muted-foreground">
                      {new Date(`${w.week}T00:00:00`).toLocaleDateString(undefined, {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-2 rounded-full bg-phase-completed"
                        style={{ width: `${share * 100}%` }}
                      />
                    </div>
                    <span className="tabular text-right">
                      {pct(w.first_pass, w.packed)}{" "}
                      <span className="text-muted-foreground">of {w.packed}</span>
                    </span>
                  </div>
                );
              })
            )}
            <p className="pt-1 text-caption text-muted-foreground">
              Mats packed without ever going to rework. Weeks start Monday.
            </p>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionTitle
            aside={
              <CsvButton
                filename={`item-mix-${range.from}-${range.to}.csv`}
                rows={data?.items ?? []}
                cols={[
                  { header: "Car", value: (i) => i.car_name },
                  { header: "Product line", value: (i) => i.product_line },
                  { header: "Mats packed", value: (i) => i.packed },
                ]}
              />
            }
          >
            Item mix (packed)
          </SectionTitle>
          <DataTable
            rows={data?.items ?? []}
            rowKey={(i) => String(i.car_model_id)}
            rowHref={(i) => `/cars/${i.car_model_id}`}
            loading={isPending}
            empty={<EmptyState title="Nothing packed in this range" />}
            columns={[
              {
                key: "car",
                header: "Car",
                card: "title",
                cell: (i) => <span className="font-medium">{i.car_name}</span>,
              },
              {
                key: "line",
                header: "Line",
                cell: (i) => <span className="font-mono text-caption">{i.product_line ?? "—"}</span>,
              },
              {
                key: "packed",
                header: "Packed",
                align: "right",
                cell: (i) => (
                  <span className="tabular">
                    {i.packed}{" "}
                    <span className="text-muted-foreground">{t?.packed ? pct(i.packed, t.packed) : ""}</span>
                  </span>
                ),
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
