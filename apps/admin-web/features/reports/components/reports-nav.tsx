"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/reports", label: "Overview" },
  { href: "/reports/workers", label: "Workers" },
  { href: "/reports/quality", label: "Quality" },
];

/** Tab bar for reports — each tab is a route; the date range (?from&to) travels with it. */
export function ReportsNav() {
  const pathname = usePathname();
  const qs = useSearchParams().toString();
  return (
    <nav aria-label="Reports" className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = pathname === t.href;
        return (
          <Link
            key={t.href}
            href={qs ? `${t.href}?${qs}` : t.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-small transition-colors",
              active
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
