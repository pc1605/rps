"use client";

import { Boxes, ChevronRight, Scissors } from "lucide-react";
import Link from "next/link";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CreateBatchDialog } from "@/features/batches/components/create-batch-dialog";
import { Pipeline } from "@/features/batches/components/pipeline";
import { useBatches } from "@/features/batches/hooks";
import { useRollsStock } from "@/features/stock/hooks";
import { batchTone, sizeLabel } from "@/lib/tokens";

export default function DashboardPage() {
  const { data: batches, isPending } = useBatches();
  const { data: rolls } = useRollsStock();

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const recent = batches?.slice(0, 6) ?? [];
  const shortCuts = (batches ?? []).filter(
    (b) => b.status === "awaiting_assignment" && b.cut_qty < b.quantity,
  );
  const lowRolls = (rolls ?? []).filter((r) => r.is_active && r.is_low);

  return (
    <div className="space-y-8">
      <PageHeader title="Today at Riddhi" description={today} actions={<CreateBatchDialog />} />
      <Pipeline />

      {/* Attention — only renders when something needs the admin */}
      {(shortCuts.length > 0 || lowRolls.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2">
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
          {lowRolls.map((r) => (
            <Link key={r.id} href="/stock">
              <Card className="flex items-center gap-3 p-3 hover:bg-accent">
                <Boxes className="h-4 w-4 text-danger" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">
                    Low stock · <span className="font-mono">{r.roll_code}</span>
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {r.remaining_meters} m left{r.color ? ` · ${r.color}` : ""}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
              </Card>
            </Link>
          ))}
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
