"use client";

import Link from "next/link";
import { AlertCircle, RefreshCw, Wrench } from "lucide-react";
import type { ReworkEntry } from "@rps/shared";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DecisionCard } from "@/features/rework/components/decision-card";
import { ReasonChip } from "@/features/rework/components/reason-chip";
import { useReworkQueue } from "@/features/rework/hooks";

function fmtStamp(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const stitcherColumns: Column<ReworkEntry>[] = [
  {
    key: "unit_code",
    header: "Unit",
    card: "title",
    cell: (r) => <span className="font-mono text-body font-medium">{r.unit_code}</span>,
  },
  {
    key: "batch_code",
    header: "Batch",
    cell: (r) => (
      <Link
        href={`/batches/${r.batch_id}`}
        className="font-mono text-small text-muted-foreground underline-offset-3 hover:text-foreground hover:underline"
      >
        {r.batch_code}
      </Link>
    ),
  },
  {
    key: "model",
    header: "Model",
    cell: (r) => {
      const name = [r.brand_name, r.model_name].filter(Boolean).join(" ");
      return (
        <span className="text-small">
          {name || "—"}
          {r.line_name && <span className="text-muted-foreground"> · {r.line_name}</span>}
        </span>
      );
    },
  },
  {
    key: "reasons",
    header: "Reasons",
    cell: (r) => (
      <div className="flex flex-wrap gap-1">
        {r.reasons.map((rsn) => (
          <ReasonChip key={rsn} reason={rsn} />
        ))}
      </div>
    ),
  },
  {
    key: "stitcher",
    header: "Stitcher",
    cell: (r) => <span className="text-small">{r.stitcher_name || "—"}</span>,
  },
  {
    key: "sent_at",
    header: "Sent at",
    cell: (r) => (
      <span className="text-small text-muted-foreground tabular">
        {fmtStamp(r.decided_at || r.flagged_at) ?? "—"}
      </span>
    ),
  },
  {
    key: "round",
    header: "Round",
    align: "right",
    cell: (r) =>
      r.round >= 2 ? (
        <Chip
          tone={{
            text: "text-brand",
            border: "border-brand/30",
            bg: "bg-brand/10",
          }}
        >
          2nd time
        </Chip>
      ) : (
        <span className="text-caption text-muted-foreground">Round 1</span>
      ),
  },
];

export default function ReworkPage() {
  const adminQueue = useReworkQueue({ status: "open", route: "admin" });
  const stitcherQueue = useReworkQueue({ status: "open", route: "stitcher" });

  const isLoading = adminQueue.isLoading || stitcherQueue.isLoading;
  const isError = adminQueue.isError || stitcherQueue.isError;

  // Filter out any entries that already have decisions in the admin queue
  const decisionItems = (adminQueue.data ?? []).filter((item) => !item.decision);
  const stitcherItems = stitcherQueue.data ?? [];

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-8">
        <PageHeader
          title="Rework"
          description="Mats sent back from packing."
          actions={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                adminQueue.refetch();
                stitcherQueue.refetch();
              }}
              disabled={isLoading}
              aria-label="Refresh rework queues"
            >
              <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? "animate-spin" : ""}`} aria-hidden />
              Refresh
            </Button>
          }
        />

        {isError && (
          <Card className="flex items-center justify-between border-danger/40 bg-danger/10 p-4 text-danger">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 shrink-0" aria-hidden />
              <span className="text-body font-medium">Failed to load rework queue.</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                adminQueue.refetch();
                stitcherQueue.refetch();
              }}
            >
              Retry
            </Button>
          </Card>
        )}

        {/* Section 1: Needs your decision */}
        <section aria-labelledby="needs-decision-heading" className="space-y-4">
          <SectionTitle
            aside={
              decisionItems.length > 0 && (
                <span className="tabular text-caption font-medium text-brand">
                  {decisionItems.length} waiting
                </span>
              )
            }
          >
            Needs your decision
          </SectionTitle>

          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full rounded-lg" />
              <Skeleton className="h-32 w-full rounded-lg" />
            </div>
          ) : decisionItems.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="No mats waiting for a decision"
              body="All rework mats have either been assigned or written off."
            />
          ) : (
            <div className="space-y-3">
              {decisionItems.map((entry) => (
                <DecisionCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </section>

        {/* Section 2: With stitchers */}
        <section aria-labelledby="with-stitchers-heading" className="space-y-4">
          <SectionTitle
            aside={
              stitcherItems.length > 0 && (
                <span className="tabular text-caption text-muted-foreground">
                  {stitcherItems.length} active
                </span>
              )
            }
          >
            With stitchers
          </SectionTitle>

          {isLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : stitcherItems.length === 0 ? (
            <EmptyState
              icon={Wrench}
              title="Nothing out for rework"
              body="No mats currently in stitching rework."
            />
          ) : (
            <DataTable
              rows={stitcherItems}
              columns={stitcherColumns}
              rowKey={(r) => r.id}
              empty={
                <EmptyState
                  icon={Wrench}
                  title="Nothing out for rework"
                  body="No mats currently in stitching rework."
                />
              }
            />
          )}
        </section>
      </div>
    </TooltipProvider>
  );
}
