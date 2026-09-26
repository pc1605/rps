"use client";

import { FileDown } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignStitchersCard } from "@/features/batches/components/assign-stitchers-card";
import { BatchTimeline } from "@/features/batches/components/batch-timeline";
import { ShortCutPanel } from "@/features/batches/components/short-cut-panel";
import { UnitCard } from "@/features/batches/components/unit-card";
import { useBatch } from "@/features/batches/hooks";
import { generateLabelPdf } from "@/features/batches/label-pdf";
import { batchTone, sizeLabel } from "@/lib/tokens";

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: batch, isPending, error } = useBatch(id);

  if (isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-80" />
        <Skeleton className="h-40 w-full" />
      </div>
    );

  if (error || !batch)
    return (
      <EmptyState
        title="Batch not found"
        body="It may have been cancelled, or the link is wrong."
        action={
          <Button asChild variant="outline">
            <Link href="/batches">Back to batches</Link>
          </Button>
        }
      />
    );

  const tone = batchTone(batch.current_phase, batch.status);
  const stitched = batch.units.filter((u) => u.stitched_at).length;

  return (
    <div className="space-y-8">
      <PageHeader
        mono
        back={{ href: "/batches", label: "Batches" }}
        title={batch.batch_code}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-foreground">
              {batch.brand_name} {batch.model_name}
            </span>
            <span>
              · {sizeLabel[batch.size_class] ?? batch.size_class}
              {batch.line_name ? ` · ${batch.line_name}` : ""} · {batch.quantity} mats
            </span>
            {batch.barcode && <span className="font-mono text-small">▮ {batch.barcode}</span>}
            {batch.parent_batch_code && (
              <Link
                href={`/batches/${batch.parent_batch_id}`}
                className="text-small text-brand hover:underline"
              >
                ↩ from {batch.parent_batch_code}
              </Link>
            )}
          </span>
        }
        actions={
          <>
            <Chip tone={tone} dot>
              {tone.label}
            </Chip>
            <Button variant="outline" onClick={() => generateLabelPdf(batch)}>
              <FileDown className="h-4 w-4" /> Labels PDF
            </Button>
          </>
        }
      />

      {batch.notes && <p className="whitespace-pre-line text-small text-muted-foreground">✎ {batch.notes}</p>}

      {/* Progress at a glance */}
      <div className="flex flex-wrap gap-x-10 gap-y-4">
        <Stat size="sm" value={batch.cut_qty} of={batch.quantity} label="cut" tone="text-phase-cutting" />
        <Stat
          size="sm"
          value={stitched}
          of={batch.units_total}
          label="stitched"
          tone="text-phase-stitching"
        />
        <Stat
          size="sm"
          value={batch.units_packed}
          of={batch.units_total}
          label="packed"
          tone="text-phase-completed"
        />
      </div>

      {/* The one thing the admin may need to do */}
      <ShortCutPanel batch={batch} />
      <AssignStitchersCard batch={batch} />

      <section>
        <SectionTitle aside={`${batch.units_total} mats`}>Units</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {batch.units.map((u) => (
            <UnitCard key={u.id} unit={u} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Production timeline</SectionTitle>
        <BatchTimeline timeline={batch.timeline} />
      </section>
    </div>
  );
}
