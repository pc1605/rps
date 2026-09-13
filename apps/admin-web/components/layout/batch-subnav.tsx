"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { useBatchStats } from "@/features/batches/hooks";
import { batchViews } from "@/features/batches/views";

export function BatchSubNav() {
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: stats } = useBatchStats();
  const active = pathname === "/batches" ? params.get("phase") : null;

  return (
    <div className="ml-4 mt-1 mb-1 border-l border-border pl-3 space-y-0.5">
      {batchViews.map((v) => {
        const n = v.count && stats ? v.count(stats) : 0;
        const isActive = active === v.key;
        return (
          <Link
            key={v.key}
            href={`/batches?phase=${v.key}`}
            className={cn(
              "flex items-center justify-between rounded-md px-2 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-colors",
              isActive
                ? "bg-primary/10 text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  v.dot,
                  n === 0 && !isActive && "opacity-30",
                )}
              />
              {v.label}
            </span>
            {n > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] tabular-nums text-foreground/80">
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
