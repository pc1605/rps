"use client";

import { useBatchStats, useBatches } from "@/features/batches/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { Scissors, Shirt, Package, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

const phaseStyle: Record<string, string> = {
  cutting: "text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  stitching: "text-pink-600 dark:text-pink-400 border-pink-500/30",
  packing: "text-amber-600 dark:text-amber-400 border-amber-500/30",
  completed: "text-lime-600 dark:text-lime-400 border-lime-500/30",
};

export default function DashboardPage() {
  const { data: stats } = useBatchStats();
  const { data: batches } = useBatches();

  const cards = [
    {
      label: "In Cutting",
      value: stats?.in_cutting ?? 0,
      icon: Scissors,
      color: "text-cyan-500",
      ring: "bg-cyan-500",
    },
    {
      label: "In Stitching",
      value: stats?.in_stitching ?? 0,
      icon: Shirt,
      color: "text-pink-500",
      ring: "bg-pink-500",
    },
    {
      label: "In Packing",
      value: stats?.in_packing ?? 0,
      icon: Package,
      color: "text-amber-500",
      ring: "bg-amber-500",
    },
    {
      label: "Completed Today",
      value: stats?.completed_today ?? 0,
      icon: CheckCircle2,
      color: "text-lime-500",
      ring: "bg-lime-500",
    },
  ];

  const recent = batches?.slice(0, 6) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Floor overview</h1>
        <p className="text-muted-foreground mt-1">
          Live production status across all phases.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          return (
            <Card key={c.label} className="relative overflow-hidden p-5">
              <div className={`absolute top-0 left-0 right-0 h-1 ${c.ring}`} />
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    {c.label}
                  </div>
                  <div className="text-4xl font-bold mt-2 tabular-nums">
                    {c.value}
                  </div>
                </div>
                <Icon className={`h-5 w-5 ${c.color}`} />
              </div>
            </Card>
          );
        })}
      </div>

      {/* Recent batches */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Recent batches</h2>
          <Link
            href="/batches"
            className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
          >
            View all →
          </Link>
        </div>
        {recent.length === 0 ? (
          <Card className="p-10 text-center text-muted-foreground text-sm">
            No batches yet.
          </Card>
        ) : (
          <div className="grid gap-2">
            {recent.map((b) => (
              <Link key={b.id} href={`/batches/${b.id}`}>
                <Card className="flex items-center justify-between px-4 py-3 hover:bg-accent transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="font-mono text-sm text-amber-600 dark:text-amber-400 shrink-0">
                      {b.batch_code}
                    </span>
                    <span className="font-medium truncate">
                      {b.brand_name} {b.model_name}
                    </span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground shrink-0">
                      {b.size_class}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-mono text-xs text-muted-foreground tabular-nums">
                      {b.units_packed}/{b.units_total}
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        "font-mono text-[10px] uppercase",
                        phaseStyle[b.current_phase],
                      )}
                    >
                      {b.current_phase}
                    </Badge>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
