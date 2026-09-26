import { cn } from "@/lib/utils";

export function StockBar({ total, remaining, low }: { total: number; remaining: number; low: boolean }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <div className="flex w-full min-w-0 items-center gap-3">
      <div
        className="h-2 flex-1 overflow-hidden rounded-full bg-muted"
        role="meter"
        aria-label="Metres remaining"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={remaining}
        aria-valuetext={`${remaining} of ${total} metres left${low ? ", low stock" : ""}`}
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            low ? "bg-danger" : "bg-phase-completed",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          "tabular whitespace-nowrap text-caption",
          low ? "text-danger" : "text-muted-foreground",
        )}
      >
        {remaining}
        <span className="text-muted-foreground/60"> / {total} m</span>
      </span>
    </div>
  );
}
