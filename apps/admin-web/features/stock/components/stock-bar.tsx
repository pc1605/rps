import { cn } from "@/lib/utils";

export function StockBar({
  total,
  remaining,
  low,
}: {
  total: number;
  remaining: number;
  low: boolean;
}) {
  const pct =
    total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  return (
    <div className="flex items-center gap-3 min-w-[180px]">
      <div className="h-2 flex-1 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            low ? "bg-red-500" : "bg-emerald-500",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-muted-foreground whitespace-nowrap">
        {remaining}/{total}m
      </span>
    </div>
  );
}
