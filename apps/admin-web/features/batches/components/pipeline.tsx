"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBatches, useBatchStats } from "../hooks";
import { batchViews } from "../views";

/** The factory, left to right. Amber only where the admin is needed. */
export function Pipeline() {
  const { data: stats, isPending } = useBatchStats();
  const { data: batches } = useBatches();

  const stages = batchViews.filter((v) => v.key !== "completed");
  const done = stats?.completed_today ?? 0;

  // Who's on each stage right now (names from that stage's active batches)
  const who = (key: string): string[] => {
    const view = batchViews.find((v) => v.key === key);
    if (!view) return [];
    const names = (batches ?? [])
      .filter(view.filter)
      .flatMap((b) => (b.active_workers ?? "").split(","))
      .map((s) => s.trim())
      .filter(Boolean);
    return Array.from(new Set(names)).slice(0, 3);
  };
  if (isPending) return <Skeleton className="h-36 w-full" />;

  return (
    <Card className="overflow-x-auto p-5 sm:p-6">
      <ol className="flex min-w-[640px] items-stretch gap-2 sm:gap-4">
        {stages.map((v, i) => {
          const n = v.count && stats ? v.count(stats) : 0;
          const ready = v.key === "ready";
          const names = who(v.key);
          return (
            <li key={v.key} className="flex flex-1 items-stretch gap-2 sm:gap-4">
              <Link
                href={`/batches?phase=${v.key}`}
                className={cn(
                  "flex flex-1 flex-col rounded-md border p-4 transition-colors hover:bg-accent",
                  ready && n > 0 && "border-brand/40 bg-brand/5",
                )}
              >
                <span className="text-small text-muted-foreground">{v.label}</span>
                <span
                  className={cn(
                    "tabular mt-1 text-display",
                    ready && n > 0 ? "text-brand" : n === 0 && "text-muted-foreground/50",
                  )}
                >
                  {n}
                </span>
                <span className="mt-2 text-caption text-muted-foreground">
                  {ready
                    ? n > 0
                      ? "Needs your assignment"
                      : "Nothing waiting"
                    : names.length
                      ? names.join(", ")
                      : n
                        ? "Waiting for a worker"
                        : "—"}
                </span>
              </Link>
              {i < stages.length - 1 && (
                <ChevronRight className="my-auto h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
              )}
            </li>
          );
        })}
        <li className="flex items-stretch gap-2 sm:gap-4">
          <ChevronRight className="my-auto h-4 w-4 shrink-0 text-muted-foreground/40" aria-hidden />
          <Link
            href="/batches?phase=completed"
            className="flex w-32 flex-col rounded-md border border-dashed p-4 hover:bg-accent"
          >
            <span className="text-small text-muted-foreground">Done today</span>
            <span className="tabular mt-1 text-display text-phase-completed">{done}</span>
          </Link>
        </li>
      </ol>
    </Card>
  );
}
