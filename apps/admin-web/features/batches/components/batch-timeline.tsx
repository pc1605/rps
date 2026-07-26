"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Scissors, Shirt, Package, CircleDot } from "lucide-react";
import type { PhaseLogEntry, Phase } from "../types";

const phaseIcon: Record<string, React.ElementType> = {
  cutting: Scissors,
  stitching: Shirt,
  packing: Package,
};

const phaseColor: Record<string, string> = {
  cutting: "text-cyan-600 dark:text-cyan-400 border-cyan-500/40",
  stitching: "text-pink-600 dark:text-pink-400 border-pink-500/40",
  packing: "text-amber-600 dark:text-amber-400 border-amber-500/40",
};

function fmtDuration(s?: number) {
  if (s == null) return null;
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BatchTimeline({ timeline }: { timeline: PhaseLogEntry[] }) {
  if (!timeline.length)
    return (
      <Card className="p-8 text-center text-muted-foreground text-sm">
        No production activity yet — waiting for a worker to start.
      </Card>
    );

  return (
    <div className="relative pl-6">
      {/* vertical rail */}
      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />

      <div className="space-y-4">
        {timeline.map((e) => {
          const Icon = phaseIcon[e.phase] ?? CircleDot;
          const open = !e.completed_at;
          const dur = fmtDuration(e.duration_seconds);
          return (
            <div key={e.id} className="relative">
              {/* node */}
              <div
                className={cn(
                  "absolute -left-6 top-3 h-5 w-5 rounded-full border-2 bg-background grid place-items-center",
                  phaseColor[e.phase] ?? "border-border",
                )}
              >
                <Icon className="h-2.5 w-2.5" />
              </div>

              <Card className={cn("p-4", open && "border-dashed")}>
                <div className="flex items-center justify-between">
                  <div className="font-medium capitalize">
                    {e.phase}
                    <span className="text-muted-foreground font-normal">
                      {" "}
                      · {e.worker_name}
                    </span>
                  </div>
                  {open ? (
                    <span className="font-mono text-[10px] uppercase text-amber-600 dark:text-amber-400 animate-pulse">
                      In progress
                    </span>
                  ) : (
                    dur && (
                      <span className="font-mono text-xs text-muted-foreground">
                        {dur}
                      </span>
                    )
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground mt-1">
                  {fmtTime(e.started_at)}
                  {e.completed_at && <> → {fmtTime(e.completed_at)}</>}
                  {e.quantity_completed != null && (
                    <span className="ml-3">· {e.quantity_completed} pcs</span>
                  )}
                </div>
                {e.notes && (
                  <p className="text-xs text-muted-foreground mt-1.5">
                    ✎ {e.notes}
                  </p>
                )}
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
