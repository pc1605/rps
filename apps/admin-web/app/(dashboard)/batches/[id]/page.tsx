"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useBatch } from "@/features/batches/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UnitStatus } from "@/features/batches/types";

const unitStyle: Record<UnitStatus, string> = {
  pending: "text-muted-foreground border-border",
  packed: "text-lime-600 dark:text-lime-400 border-lime-500/30",
  defective: "text-destructive border-destructive/30",
  dispatched: "text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
};

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: batch, isLoading, error } = useBatch(id);

  if (isLoading)
    return <p className="font-mono text-sm text-muted-foreground">Loading…</p>;
  if (error || !batch)
    return (
      <p className="font-mono text-sm text-destructive">Batch not found.</p>
    );

  return (
    <div className="space-y-6">
      <Link
        href="/batches"
        className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" /> Batches
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">
            {batch.batch_code}
          </h1>
          <p className="text-muted-foreground mt-1">
            {batch.brand_name} {batch.model_name} · {batch.quantity} mats ·{" "}
            <span className="uppercase font-mono text-xs">
              {batch.size_class}
            </span>
          </p>
          {batch.notes && (
            <p className="text-sm text-muted-foreground mt-2">
              ✎ {batch.notes}
            </p>
          )}
        </div>
        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          {batch.current_phase}
        </Badge>
      </div>

      <div>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Units · {batch.units_packed}/{batch.units_total} packed
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {batch.units.map((u) => (
            <Card key={u.id} className="p-3">
              <div className="font-mono text-xs">{u.unit_code}</div>
              <Badge
                variant="outline"
                className={cn(
                  "mt-2 font-mono text-[9px] uppercase",
                  unitStyle[u.status],
                )}
              >
                {u.status}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
