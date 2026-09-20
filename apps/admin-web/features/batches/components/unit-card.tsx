"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Unit, UnitStatus } from "../types";

const unitStyle: Record<UnitStatus | "stitched", string> = {
  pending: "text-muted-foreground border-border",
  stitched: "text-pink-600 dark:text-pink-400 border-pink-500/30",
  packed: "text-lime-600 dark:text-lime-400 border-lime-500/30",
  defective: "text-destructive border-destructive/30",
  dispatched: "text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
};

export function fmtStamp(iso?: string) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function displayState(u: Unit): UnitStatus | "stitched" {
  return u.status === "pending" && u.stitched_at ? "stitched" : u.status;
}

export function UnitCard({ unit: u }: { unit: Unit }) {
  const state = displayState(u);

  // Ordered activity — Slice B will append rework flagged/fixed events here
  const events: { icon: string; who?: string; at?: string; label: string }[] = [
    {
      icon: "🧵",
      label: "Stitched",
      who: u.stitched_by_name,
      at: u.stitched_at,
    },
    { icon: "📦", label: "Packed", who: u.packed_by_name, at: u.packed_at },
  ];

  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs">{u.unit_code}</span>
        <Badge
          variant="outline"
          className={cn("font-mono text-[9px] uppercase", unitStyle[state])}
        >
          {state}
        </Badge>
      </div>

      <ul className="space-y-1">
        {events.map((e) =>
          e.at ? (
            <li
              key={e.label}
              className="flex items-start gap-1.5 text-[11px] leading-tight"
            >
              <span aria-hidden>{e.icon}</span>
              <span className="min-w-0">
                <span className="text-foreground">{e.who ?? e.label}</span>
                <time
                  dateTime={e.at}
                  className="block text-muted-foreground tabular-nums"
                >
                  {fmtStamp(e.at)}
                </time>
              </span>
            </li>
          ) : (
            <li
              key={e.label}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60"
            >
              <span aria-hidden>{e.icon}</span>
              <span>{e.label} — pending</span>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}
