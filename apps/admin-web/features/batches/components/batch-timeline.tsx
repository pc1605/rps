"use client";

import { CircleDot, Clock, Package, Scissors, Shirt } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";
import { Card } from "@/components/ui/card";
import { phaseTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { Phase, PhaseLogEntry } from "../types";
import { fmtStamp } from "./unit-card";

const phaseIcon: Partial<Record<Phase, React.ElementType>> = {
  cutting: Scissors,
  stitching: Shirt,
  packing: Package,
};

function fmtDuration(s?: number) {
  if (s == null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

export function BatchTimeline({ timeline }: { timeline: PhaseLogEntry[] }) {
  if (!timeline.length)
    return (
      <EmptyState
        icon={Clock}
        title="No production activity yet"
        body="The timeline fills in as workers start and complete each phase."
      />
    );

  return (
    <ol className="relative pl-6">
      <div className="absolute bottom-2 left-[9px] top-2 w-px bg-border" aria-hidden />

      <div className="space-y-3">
        {timeline.map((e) => {
          const Icon = phaseIcon[e.phase] ?? CircleDot;
          const tone = phaseTone[e.phase];
          const open = !e.completed_at;
          const dur = fmtDuration(e.duration_seconds);

          return (
            <li key={e.id} className="relative">
              <div
                className={cn(
                  "absolute -left-6 top-3 grid h-5 w-5 place-items-center rounded-full border-2 bg-background",
                  tone.text,
                  tone.border,
                )}
                aria-hidden
              >
                <Icon className="h-2.5 w-2.5" />
              </div>

              <Card className={cn("p-4", open && "border-dashed")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-body font-medium">
                    <span className={tone.text}>{tone.label}</span>
                    <span className="font-normal text-muted-foreground"> · {e.worker_name}</span>
                  </div>
                  {open ? (
                    <span className="inline-flex items-center gap-1.5 text-caption text-working">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-working" aria-hidden />
                      In progress
                    </span>
                  ) : (
                    dur && <span className="tabular text-caption text-muted-foreground">{dur}</span>
                  )}
                </div>

                <div className="tabular mt-1 text-caption text-muted-foreground">
                  <time dateTime={e.started_at}>{fmtStamp(e.started_at)}</time>
                  {e.completed_at && (
                    <>
                      {" "}
                      → <time dateTime={e.completed_at}>{fmtStamp(e.completed_at)}</time>
                    </>
                  )}
                  {e.quantity_completed != null && <span className="ml-3">· {e.quantity_completed} pcs</span>}
                </div>

                {e.notes && <p className="mt-1.5 text-caption text-muted-foreground">✎ {e.notes}</p>}
              </Card>
            </li>
          );
        })}
      </div>
    </ol>
  );
}
