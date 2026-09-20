"use client";

import { use } from "react";
import Link from "next/link";
import { ArrowLeft, FileDown } from "lucide-react";
import { useBatch } from "@/features/batches/hooks";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BatchTimeline } from "@/features/batches/components/batch-timeline";
import { AssignStitchersCard } from "@/features/batches/components/assign-stitchers-card";
import { generateLabelPdf } from "@/features/batches/label-pdf";
import { UnitCard } from "@/features/batches/components/unit-card";
import { ShortCutPanel } from "@/features/batches/components/short-cut-panel";

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
    <div className="space-y-8">
      <div className="space-y-6">
        <Link
          href="/batches"
          className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Batches
        </Link>

        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold font-mono text-primary">
              {batch.batch_code}
            </h1>
            <p className="text-muted-foreground mt-1">
              {batch.brand_name} {batch.model_name} · {batch.quantity} mats ·{" "}
              <span className="uppercase font-mono text-xs">
                {batch.size_class}
              </span>
              {batch.line_name && <> · {batch.line_name}</>}
              {batch.barcode && (
                <span className="ml-3 font-mono text-xs text-muted-foreground">
                  ▮ {batch.barcode}
                </span>
              )}
            </p>
            {batch.notes && (
              <p className="text-sm text-muted-foreground mt-2">
                ✎ {batch.notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => generateLabelPdf(batch)}
            >
              <FileDown className="h-4 w-4" /> Labels PDF
            </Button>
            <Badge
              variant="outline"
              className="font-mono text-[10px] uppercase"
            >
              {batch.current_phase}
            </Badge>
          </div>
        </div>
      </div>
      <ShortCutPanel batch={batch} />
      <AssignStitchersCard batch={batch} />
      <div>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Production timeline
        </h2>
        <BatchTimeline timeline={batch.timeline} />
      </div>

      <div>
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Units · {batch.units.filter((u) => u.stitched_at).length}/
          {batch.units_total} stitched · {batch.units_packed}/
          {batch.units_total} packed
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
          {batch.units.map((u) => (
            <UnitCard key={u.id} unit={u} />
          ))}
        </div>
      </div>
    </div>
  );
}
