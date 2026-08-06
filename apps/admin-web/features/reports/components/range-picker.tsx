"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function presetRanges(): DateRange[] {
  const today = new Date();
  const days = (n: number) => new Date(Date.now() - n * 86_400_000);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  return [
    { label: "Today", from: fmt(today), to: fmt(today) },
    { label: "Last 7 days", from: fmt(days(6)), to: fmt(today) },
    { label: "This month", from: fmt(monthStart), to: fmt(today) },
    { label: "Last 30 days", from: fmt(days(29)), to: fmt(today) },
  ];
}

export function RangePicker({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (r: DateRange) => void;
}) {
  const presets = presetRanges();
  const isCustom = !presets.some(
    (p) => p.from === value.from && p.to === value.to,
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.label}
          variant={
            p.from === value.from && p.to === value.to ? "default" : "outline"
          }
          size="sm"
          onClick={() => onChange(p)}
        >
          {p.label}
        </Button>
      ))}
      <div
        className={cn(
          "flex items-center gap-2 ml-2",
          isCustom && "opacity-100",
        )}
      >
        <Input
          type="date"
          value={value.from}
          onChange={(e) =>
            onChange({ from: e.target.value, to: value.to, label: "Custom" })
          }
          className="w-[150px] h-8 text-xs"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
          type="date"
          value={value.to}
          onChange={(e) =>
            onChange({ from: value.from, to: e.target.value, label: "Custom" })
          }
          className="w-[150px] h-8 text-xs"
        />
      </div>
    </div>
  );
}
