"use client";

import {
  REWORK_REASON_LABEL,
  type ReworkReason,
  type WorkerDetail,
  type WorkerHistoryRow,
} from "@rps/shared";
import { Activity, History, Wrench } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { BatchLink, CarLink, UnitLink } from "@/components/rps/entity-link";
import { SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type DateRange, defaultRange, RangePicker } from "@/features/reports/components/range-picker";
import { fmtAgo, fmtDay, fmtDuration, fmtStamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { phaseTone, stationTone } from "@/lib/tokens";
import { useWorkerHistory, useWorkerSummary } from "../hooks";

// ───── Now ─────

export function WorkerNow({ worker }: { worker: WorkerDetail }) {
  const { open_claims: claims, assigned, open_rework: rework } = worker;
  const empty = !claims.length && !assigned.length && !rework.length;
  return (
    <section>
      <SectionTitle>Now</SectionTitle>
      {empty ? (
        <EmptyState icon={Activity} title="Not working on anything right now" />
      ) : (
        <div className="grid gap-2 md:grid-cols-2">
          {claims.map((c) => {
            const tone = phaseTone[c.phase];
            return (
              <Card
                key={`c-${c.batch_id}-${c.phase}`}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-working" aria-hidden />
                    <span className="sr-only">Working now:</span>
                    <BatchLink id={c.batch_id} code={c.batch_code} className="text-small" />
                    <Chip tone={tone}>{tone.label}</Chip>
                  </div>
                  <div className="mt-1 truncate text-small">{c.car_name}</div>
                  <div className="text-caption text-muted-foreground">since {fmtStamp(c.started_at)}</div>
                </div>
                {c.phase !== "cutting" && (
                  <Stat
                    size="sm"
                    value={c.my_done}
                    of={c.target_qty ?? undefined}
                    label="mine"
                    className="items-end"
                  />
                )}
              </Card>
            );
          })}
          {assigned.map((a) => (
            <Card
              key={`a-${a.batch_id}-${a.phase}`}
              className="flex items-center justify-between gap-3 border-dashed p-4"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <BatchLink id={a.batch_id} code={a.batch_code} className="text-small" />
                  <span className="text-caption text-muted-foreground">assigned, not joined yet</span>
                </div>
                <div className="mt-1 truncate text-small">{a.car_name}</div>
              </div>
              <Stat
                size="sm"
                value={a.my_done}
                of={a.target_qty ?? undefined}
                label="share"
                className="items-end"
              />
            </Card>
          ))}
          {rework.map((r) => (
            <Card key={`r-${r.id}`} className="flex items-start gap-3 border-danger/30 p-4">
              <Wrench className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
              <div className="min-w-0 text-small">
                <div className="flex flex-wrap items-center gap-2">
                  <UnitLink code={r.unit_code} />
                  <span className="text-caption text-muted-foreground">
                    in <BatchLink id={r.batch_id} code={r.batch_code} />
                  </span>
                  {r.round > 1 && <span className="text-caption text-danger">round {r.round}</span>}
                </div>
                <div className="mt-1 text-caption text-muted-foreground">
                  {r.reasons.map((x) => REWORK_REASON_LABEL[x]).join(" · ")} · {fmtAgo(r.flagged_at)}
                  {r.awaiting_decision && " · waiting for your decision"}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ───── Output ─────

export function WorkerOutput({ worker }: { worker: WorkerDetail }) {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data: s, isPending, isError } = useWorkerSummary(worker.id, range.from, range.to);
  const max = Math.max(1, ...(s?.days ?? []).map((d) => d.mats));
  const reasons = Object.entries(s?.rework_caused?.by_reason ?? {}).sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0));

  return (
    <section className="space-y-4">
      <SectionTitle>Output</SectionTitle>
      <RangePicker value={range} onChange={setRange} />
      {isError ? (
        <EmptyState
          title="Couldn't load output"
          body="Check the backend is running, then try another range."
        />
      ) : isPending || !s ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
            <Stat size="sm" value={s.today} label={`${s.unit} today`} />
            <Stat size="sm" value={s.last_7_days} label="last 7 days" />
            <Stat size="sm" value={s.total} label={`${s.unit} · ${range.label.toLowerCase()}`} />
            {s.mats_per_hour != null && <Stat size="sm" value={s.mats_per_hour} label="per active hour" />}
            {s.rework_caused && (
              <Stat
                size="sm"
                value={s.rework_caused.rounds}
                label={
                  s.rework_caused.rate_pct != null
                    ? `rework caused · ${s.rework_caused.rate_pct}%`
                    : "rework caused"
                }
                tone={s.rework_caused.rounds ? "text-danger" : undefined}
              />
            )}
            {s.rework_fixed && (
              <Stat
                size="sm"
                value={s.rework_fixed.count}
                label={
                  s.rework_fixed.median_turnaround_secs != null
                    ? `rework fixed · median ${fmtDuration(s.rework_fixed.median_turnaround_secs)}`
                    : "rework fixed"
                }
              />
            )}
            {s.flagged != null && <Stat size="sm" value={s.flagged} label="sent to rework" />}
          </Card>

          {reasons.length > 0 && (
            <p className="text-small text-muted-foreground">
              Rework reasons:{" "}
              {reasons.map(([r, n]) => `${REWORK_REASON_LABEL[r as ReworkReason] ?? r} ${n}`).join(" · ")}
            </p>
          )}

          {s.days.length === 0 ? (
            <EmptyState title="No output in this range" />
          ) : (
            <Card className="p-4">
              <ul className="space-y-1.5" aria-label={`${s.unit} per day`}>
                {s.days.map((d) => (
                  <li key={d.day} className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-3 text-small">
                    <span className="text-muted-foreground">{fmtDay(d.day)}</span>
                    <span className="h-2.5 rounded-full bg-muted">
                      <span
                        className={cn("block h-full rounded-full", stationTone[worker.station].dot)}
                        style={{ width: `${(d.mats / max) * 100}%` }}
                      />
                    </span>
                    <span className="tabular text-right">{d.mats}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

// ───── History ─────

const historyColumns: Column<WorkerHistoryRow>[] = [
  {
    key: "batch",
    header: "Batch",
    card: "title",
    cell: (h) => <BatchLink id={h.batch_id} code={h.batch_code} className="text-small" />,
  },
  {
    key: "car",
    header: "Item",
    cell: (h) => (
      <CarLink id={h.car_model_id} className="text-small">
        {h.car_name}
      </CarLink>
    ),
  },
  {
    key: "phase",
    header: "Phase",
    cell: (h) => {
      const tone = phaseTone[h.phase];
      return (
        <Chip tone={tone} dot={!h.completed_at}>
          {tone.label}
        </Chip>
      );
    },
  },
  {
    key: "mats",
    header: "Mats",
    align: "right",
    cell: (h) => (
      <span className="tabular">
        {h.mats}
        {h.target_qty != null && <span className="text-muted-foreground"> / {h.target_qty}</span>}
      </span>
    ),
  },
  {
    key: "rework",
    header: "Rework",
    align: "right",
    cell: (h) =>
      h.rework_caused ? (
        <span className="tabular text-danger">{h.rework_caused}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "when",
    header: "When",
    align: "right",
    cell: (h) => {
      const from = h.first_scan_at ?? h.started_at;
      const to = h.last_scan_at ?? h.completed_at;
      const secs = to ? (new Date(to).getTime() - new Date(from).getTime()) / 1000 : 0;
      const dur = secs >= 60 ? fmtDuration(secs) : null; // single-scan / instant spans say nothing
      return (
        <span className="tabular text-caption text-muted-foreground">
          {fmtStamp(h.started_at)}
          {dur ? ` · ${dur}` : h.completed_at ? "" : " · open"}
        </span>
      );
    },
  },
];

export function WorkerHistory({ worker }: { worker: WorkerDetail }) {
  const q = useWorkerHistory(worker.id);
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <section className="space-y-3">
      <SectionTitle>Work history</SectionTitle>
      {q.isError ? (
        <EmptyState title="Couldn't load history" />
      ) : (
        <DataTable
          rows={rows}
          columns={historyColumns}
          rowKey={(h) => h.phase_log_id}
          loading={q.isPending}
          empty={
            <EmptyState
              icon={History}
              title="No work yet"
              body="Batches appear here once they start or join one."
            />
          }
        />
      )}
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </section>
  );
}
