"use client";

import { Chip } from "@/components/rps/chip";
import { Card } from "@/components/ui/card";
import { unitTone } from "@/lib/tokens";
import type { Unit } from "../types";

export function fmtStamp(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

type UnitState = keyof typeof unitTone;

function displayState(u: Unit): UnitState {
  return u.status === "pending" && u.stitched_at ? "stitched" : u.status;
}

export function UnitCard({ unit: u }: { unit: Unit }) {
  const tone = unitTone[displayState(u)];

  // Ordered activity — Slice B appends rework flagged/fixed events here
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
    <Card className="space-y-2 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-small">{u.unit_code}</span>
        <Chip tone={tone}>{tone.label}</Chip>
      </div>

      <ul className="space-y-1">
        {events.map((e) =>
          e.at ? (
            <li key={e.label} className="flex items-start gap-1.5 text-caption leading-tight">
              <span aria-hidden>{e.icon}</span>
              <span className="min-w-0">
                <span className="text-foreground">{e.who ?? e.label}</span>
                <time dateTime={e.at} className="tabular block text-muted-foreground">
                  {fmtStamp(e.at)}
                </time>
              </span>
            </li>
          ) : (
            <li key={e.label} className="flex items-center gap-1.5 text-caption text-muted-foreground/60">
              <span aria-hidden>{e.icon}</span>
              <span>{e.label} — pending</span>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}
