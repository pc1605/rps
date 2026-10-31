"use client";

import { Boxes, ChevronRight, Hourglass, Scissors, Wrench } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBatchDialog } from "@/features/batches/components/create-batch-dialog";
import { Pipeline } from "@/features/batches/components/pipeline";
import { useBatchPage, useBatchStats } from "@/features/batches/hooks";
import { useStuck } from "@/features/reports/hooks";
import { batchTone, sizeLabel } from "@/lib/tokens";

export default function DashboardPage() {
  // Small, targeted queries (U2) — the dashboard never loads the whole batch list.
  const { data: recentPage, isPending } = useBatchPage({ limit: 6 });
  const { data: shortPage } = useBatchPage({ view: "ready", short: true, limit: 20 });
  const { data: stats } = useBatchStats();
  const { data: stuckList } = useStuck();
  const stuck = stuckList?.length ?? 0;

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const recent = recentPage?.items ?? [];
  const shortCuts = shortPage?.items ?? [];
  const lowTypes = stats?.low_stock_types ?? 0;
  const shortfalls = stats?.material_shortfalls_open ?? 0;
  const reworkNeedsDecision = stats?.rework_needs_decision ?? 0;
  const reworkOpen = stats?.rework_open ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader title="Today at RPS" description={today} actions={<CreateBatchDialog />} />
      <Pipeline />

      {/* Attention — only renders when something needs the admin */}
      {(reworkNeedsDecision > 0 ||
        reworkOpen > 0 ||
        shortCuts.length > 0 ||
        lowTypes > 0 ||
        shortfalls > 0 ||
        stuck > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
          {reworkNeedsDecision > 0 && (
            <Link href="/rework">
              <Card className="flex items-center gap-3 border-brand/40 bg-brand/5 p-3 hover:bg-brand/10">
                <Wrench className="h-4 w-4 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    {reworkNeedsDecision} {reworkNeedsDecision === 1 ? "mat needs" : "mats need"} your
                    decision
                  </div>
                  <div className="text-caption text-muted-foreground">
                    Sent back from packing — review reasons and decide next step
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          )}
          {reworkOpen > 0 && (
            <Link href="/rework">
              <Card className="flex items-center gap-3 p-3 hover:bg-accent">
                <Wrench className="h-4 w-4 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    {reworkOpen} {reworkOpen === 1 ? "mat" : "mats"} out for rework
                  </div>
                  <div className="text-caption text-muted-foreground">In stitching repair queue</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          )}
          {shortCuts.map((b) => (
            <Link key={b.id} href={`/batches/${b.id}`}>
              <Card className="flex items-center gap-3 border-brand/40 bg-brand/5 p-3 hover:bg-brand/10">
                <Scissors className="h-4 w-4 text-brand" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    Short cut on <span className="font-mono">{b.batch_code}</span>
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {b.cut_qty} of {b.quantity} cut — decide what happens to the rest
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          ))}
          {stuck > 0 && (
            <Link href="/reports#stuck">
              <Card className="flex items-center gap-3 p-3 hover:bg-accent">
                <Hourglass className="h-4 w-4 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    {stuck} batch{stuck === 1 ? "" : "es"} stuck
                  </div>
                  <div className="text-caption text-muted-foreground">
                    No scan or step past the stage's threshold — oldest: {stuckList?.[0]?.batch_code}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          )}
          {lowTypes > 0 && (
            <Link href="/materials?low=1">
              <Card className="flex items-center gap-3 p-3 hover:bg-accent">
                <Boxes className="h-4 w-4 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    {lowTypes} material{lowTypes === 1 ? "" : "s"} below minimum
                  </div>
                  <div className="text-caption text-muted-foreground">Receive stock before the next cuts</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          )}
          {shortfalls > 0 && (
            <Link href="/materials/ledger">
              <Card className="flex items-center gap-3 p-3 hover:bg-accent">
                <Boxes className="h-4 w-4 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    {shortfalls} material shortfall{shortfalls === 1 ? "" : "s"} (30 days)
                  </div>
                  <div className="text-caption text-muted-foreground">
                    Cuts used more than the recorded stock — check counts
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          )}
        </div>
      )}

      {/* Recent batches */}
      <section>
        <SectionTitle
          aside={
            <Link href="/batches" className="text-brand hover:underline">
              All batches
            </Link>
          }
        >
          Recent batches
        </SectionTitle>

        {isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <EmptyState
            title="No batches yet"
            body="Create the first order and it will show up here and on the pipeline above."
          />
        ) : (
          <ul className="grid gap-2">
            {recent.map((b) => {
              const tone = batchTone(b.current_phase, b.status);
              return (
                <li key={b.id}>
                  <Link href={`/batches/${b.id}`}>
                    <Card className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-accent">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="shrink-0 font-mono text-small text-brand">{b.batch_code}</span>
                        <span className="truncate font-medium">
                          {b.brand_name} {b.model_name}
                        </span>
                        <span className="hidden shrink-0 text-caption text-muted-foreground sm:inline">
                          {sizeLabel[b.size_class]}
                          {b.line_name ? ` · ${b.line_name}` : ""}
                        </span>
                      </div>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="tabular text-caption text-muted-foreground">
                          {b.units_packed}/{b.units_total}
                          {b.units_written_off > 0 && (
                            <span className="text-danger"> · {b.units_written_off} off</span>
                          )}
                        </span>
                        <Chip tone={tone} dot>
                          {tone.label}
                        </Chip>
                      </div>
                    </Card>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
