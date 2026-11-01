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
import { StitchingAssignmentCard } from "@/features/batches/components/stitching-assignment-card";
import { BatchMaterials } from "@/features/batches/components/batch-materials";
import { CancelBatchDialog } from "@/features/batches/components/cancel-batch-dialog";
import { EditBatchDialog } from "@/features/batches/components/edit-batch-dialog";
import { BatchTimeline } from "@/features/batches/components/batch-timeline";
import { ShortCutPanel } from "@/features/batches/components/short-cut-panel";
import { UnitCard } from "@/features/batches/components/unit-card";
import { useBatch } from "@/features/batches/hooks";
import { generateLabelPdf } from "@/features/batches/label-pdf";
import { batchViews } from "@/features/batches/views";
import { CarLink, LotLink } from "@/components/rps/entity-link";
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
  const spare = batch.units.filter((u) => u.status === "spare").length;
  const view = batchViews.find((v) => v.filter(batch));

  return (
    <div className="space-y-8">
      <PageHeader
        mono
        crumbs={[
          { label: "Batches", href: "/batches" },
          ...(view ? [{ label: view.label, href: `/batches?phase=${view.key}` }] : []),
        ]}
        title={batch.batch_code}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <CarLink id={batch.car_model_id} className="text-foreground">
              {batch.brand_name} {batch.model_name}
            </CarLink>
            <span>
              · {sizeLabel[batch.size_class] ?? batch.size_class}
              {batch.line_name ? ` · ${batch.line_name}` : ""} · {batch.quantity} mats
            </span>
            {batch.barcode && <span className="font-mono text-small">▮ {batch.barcode}</span>}
            {batch.roll_id && (
              <span className="text-small">
                roll <LotLink id={batch.roll_id} code={batch.roll_code} />
              </span>
            )}
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
            <EditBatchDialog batch={batch} />
            <CancelBatchDialog batch={batch} />
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
          value={batch.units_stitched ?? 0}
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
        {batch.units_written_off > 0 && (
          <Stat size="sm" value={batch.units_written_off} label="written off" tone="text-danger" />
        )}
        {spare > 0 && <Stat size="sm" value={spare} label="spare" tone="text-muted-foreground" />}
        {(batch.rework_open ?? 0) > 0 && (
          <Stat size="sm" value={batch.rework_open ?? 0} label="in rework" tone="text-danger" />
        )}
      </div>

      {/* The one thing the admin may need to do */}
      <ShortCutPanel batch={batch} />
      <StitchingAssignmentCard batch={batch} />

      <section>
        <SectionTitle aside={`${batch.units_total} mats`}>Units</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {batch.units.map((u) => (
            <UnitCard key={u.id} unit={u} allowUndo={batch.status !== "cancelled"} />
          ))}
        </div>
      </section>

      <BatchMaterials batchId={batch.id} />

      <section>
        <SectionTitle>Production timeline</SectionTitle>
        <BatchTimeline
          timeline={batch.timeline}
          releaseBatchId={
            batch.current_phase === "cutting" && batch.status === "in_progress" ? batch.id : undefined
          }
        />
      </section>
    </div>
  );
}
