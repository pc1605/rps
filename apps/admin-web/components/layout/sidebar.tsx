"use client";

import {
  BarChart3,
  Boxes,
  Car,
  LayoutDashboard,
  type LucideIcon,
  Package,
  Users,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { useBatchStats } from "@/features/batches/hooks";
import { cn } from "@/lib/utils";
import { BatchSubNav } from "./batch-subnav";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/batches", label: "Batches", icon: Package },
  { href: "/rework", label: "Rework", icon: Wrench },
  { href: "/cars", label: "Cars", icon: Car },
  { href: "/stock", label: "Stock", icon: Boxes },
  { href: "/workers", label: "Workers", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
];

/** Nav list only — used by the desktop rail and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { data: stats } = useBatchStats();
  const reworkOpen = stats?.rework_open ?? 0;
  const reworkNeedsDecision = (stats?.rework_needs_decision ?? 0) > 0;

  return (
    <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main">
      {navItems.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        const isRework = item.href === "/rework";

        return (
          <div key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-11 items-center justify-between rounded-md px-3 text-body transition-colors",
                active
                  ? "bg-brand/10 text-brand font-medium"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <span className="flex items-center gap-3">
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </span>
              {isRework && reworkOpen > 0 && (
                <span
                  className={cn(
                    "tabular rounded-full px-2 py-0.5 text-caption font-medium",
                    reworkNeedsDecision ? "text-brand" : "bg-muted text-muted-foreground",
                  )}
                >
                  {reworkOpen}
                </span>
              )}
            </Link>
            {item.href === "/batches" && (
              <Suspense fallback={null}>
                <BatchSubNav onNavigate={onNavigate} />
              </Suspense>
            )}
          </div>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <div className="border-b px-6 py-5">
      <div className="text-caption font-medium tracking-wide text-brand">Ambika · Riddhi</div>
      <div className="text-h2 leading-tight">RPS</div>
    </div>
  );
}

/** Desktop rail (≥ lg). The mobile drawer lives in app-shell.tsx. */
export function Sidebar() {
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r bg-card">
      <Brand />
      <SidebarNav />
    </aside>
  );
}
