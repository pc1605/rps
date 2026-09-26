"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useBatchStats } from "@/features/batches/hooks";
import { batchViews } from "@/features/batches/views";
import { cn } from "@/lib/utils";

export function BatchSubNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: stats } = useBatchStats();
  const active = pathname === "/batches" ? params.get("phase") : null;

  return (
    <div className="ml-4 mt-1 mb-1 space-y-0.5 border-l pl-3">
      {batchViews.map((v) => {
        const n = v.count && stats ? v.count(stats) : 0;
        const isActive = active === v.key;
        return (
          <Link
            key={v.key}
            href={`/batches?phase=${v.key}`}
            onClick={onNavigate}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-10 items-center justify-between rounded-md px-2 text-caption transition-colors",
              isActive
                ? "bg-brand/10 text-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
          >
            <span className="inline-flex items-center gap-2">
              <span
                className={cn("h-1.5 w-1.5 rounded-full", v.dot, n === 0 && !isActive && "opacity-30")}
                aria-hidden
              />
              {v.label}
            </span>
            {n > 0 && (
              <span className="tabular rounded-full bg-muted px-1.5 py-0.5 text-caption text-foreground/80">
                {n}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
