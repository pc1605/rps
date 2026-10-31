"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const fmtDay = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

/**
 * One series per chart (small multiples — never stacked or dual-axis). Bars grow from a baseline with
 * a 2px gap, rounded data end; hover/focus shows the day's value. The title names the series, so no legend.
 */
export function DayBars({
  title,
  days,
  barClass,
  unit,
  height = "h-24",
}: {
  title: string;
  days: { day: string; value: number }[];
  /** A bg-* token class for the bars, e.g. bg-phase-packing. */
  barClass: string;
  unit: string;
  height?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const peak = Math.max(0, ...days.map((d) => d.value));
  const max = Math.max(1, peak);
  const total = days.reduce((s, d) => s + d.value, 0);
  const h = hover != null ? days[hover] : undefined;
  const first = days[0];
  const last = days[days.length - 1];

  return (
    <figure className="min-w-0 space-y-2">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-small font-medium">{title}</span>
        <span className="tabular text-caption text-muted-foreground">
          {h ? (
            <>
              {fmtDay(h.day)} · <span className="text-foreground">{h.value}</span> {unit}
            </>
          ) : (
            <>
              {total} {unit} · peak {peak}
            </>
          )}
        </span>
      </figcaption>
      <div className={cn("relative flex items-end gap-[2px] border-b border-border", height)} aria-hidden>
        {/* recessive gridline at the peak */}
        <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
        {days.map((d, i) => (
          <div
            key={d.day}
            role="img"
            aria-label={`${fmtDay(d.day)}: ${d.value} ${unit}`}
            className="flex h-full min-w-0 flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={cn(
                "w-full rounded-t-[4px] transition-opacity",
                barClass,
                hover != null && hover !== i && "opacity-40",
              )}
              style={{ height: d.value ? `max(2px, ${(d.value / max) * 100}%)` : 0 }}
            />
          </div>
        ))}
      </div>
      {first && last && (
        <div className="flex justify-between text-caption text-muted-foreground" aria-hidden>
          <span>{fmtDay(first.day)}</span>
          <span>{fmtDay(last.day)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{title}</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{d.day}</th>
              <td>
                {d.value} {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
