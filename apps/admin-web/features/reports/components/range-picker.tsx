"use client";

import { factoryDay } from "@rps/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;
  label: string;
}

// Factory-day strings (FACTORY_TZ). IST has no DST, so n × 24 h steps are exact days.
export function presetRanges(): DateRange[] {
  const today = factoryDay();
  const daysAgo = (n: number) => factoryDay(new Date(Date.now() - n * 86_400_000));
  const monthStart = `${today.slice(0, 7)}-01`;
  return [
    { label: "Today", from: today, to: today },
    { label: "Last 7 days", from: daysAgo(6), to: today },
    { label: "This month", from: monthStart, to: today },
    { label: "Last 30 days", from: daysAgo(29), to: today },
  ];
}

export function defaultRange(): DateRange {
  const ranges = presetRanges();
  return ranges.find((r) => r.label === "Last 7 days") ?? ranges[0] ?? { label: "Today", from: "", to: "" };
}

export function RangePicker({ value, onChange }: { value: DateRange; onChange: (r: DateRange) => void }) {
  const presets = presetRanges();
  const isCustom = !presets.some((p) => p.from === value.from && p.to === value.to);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {presets.map((p) => (
        <Button
          key={p.label}
          variant={p.from === value.from && p.to === value.to ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(p)}
        >
          {p.label}
        </Button>
      ))}
      <div className={cn("flex items-center gap-2 ml-2", isCustom && "opacity-100")}>
        <Input
          type="date"
          value={value.from}
          onChange={(e) => onChange({ from: e.target.value, to: value.to, label: "Custom" })}
          className="w-[150px] h-8 text-xs"
        />
        <span className="text-muted-foreground text-xs">→</span>
        <Input
          type="date"
          value={value.to}
          onChange={(e) => onChange({ from: value.from, to: e.target.value, label: "Custom" })}
          className="w-[150px] h-8 text-xs"
        />
      </div>
    </div>
  );
}
