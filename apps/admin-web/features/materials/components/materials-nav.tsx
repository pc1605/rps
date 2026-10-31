"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/materials", label: "Stock" },
  { href: "/materials/ledger", label: "Ledger" },
  { href: "/materials/types", label: "Types" },
  { href: "/materials/recipes", label: "Recipes" },
];

/** Tab bar for the materials area — each tab is its own route (linkable, back-button safe). */
export function MaterialsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Materials" className="flex gap-1 border-b">
      {tabs.map((t) => {
        const active = t.href === "/materials" ? pathname === "/materials" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
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
