"use client";

import {
  MATERIAL_UNIT_LABEL,
  MOVEMENT_KIND_LABEL,
  type MaterialLotDetail,
  type MaterialMovementRow,
} from "@rps/shared";
import { Boxes, History } from "lucide-react";
import Link from "next/link";
import { use } from "react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { BatchLink, WorkerLink } from "@/components/rps/entity-link";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { EditLotDialog, LotMovementDialog } from "@/features/materials/components/lot-dialogs";
import { useLot, useLotMovements } from "@/features/materials/hooks";
import { fmtStamp } from "@/lib/format";
import { phaseTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";

type LotBatch = MaterialLotDetail["batches"][number];

function batchColumns(unit: string): Column<LotBatch>[] {
  return [
    {
      key: "code",
      header: "Batch",
      card: "title",
      cell: (b) => <BatchLink id={b.batch_id} code={b.batch_code} className="text-small" />,
    },
    { key: "car", header: "Item", cell: (b) => <span className="text-small">{b.car_name}</span> },
    {
      key: "phase",
      header: "Phase",
      cell: (b) => {
        const tone = phaseTone[b.current_phase];
        return <Chip tone={tone}>{tone.label}</Chip>;
      },
    },
    {
      key: "qty",
      header: "Mats",
      align: "right",
      cell: (b) => <span className="tabular">{b.quantity}</span>,
    },
    {
      key: "drawn",
      header: "Drawn",
      align: "right",
      cell: (b) => (
        <span className="tabular">
          {b.drawn ? `${b.drawn} ${unit}` : <span className="text-muted-foreground">roll only</span>}
        </span>
      ),
    },
  ];
}

function movementColumns(unit: string): Column<MaterialMovementRow>[] {
  return [
    {
      key: "when",
      header: "When",
      card: "title",
      cell: (m) => (
        <time dateTime={m.created_at} className="tabular text-small">
          {fmtStamp(m.created_at)}
        </time>
      ),
    },
    {
      key: "kind",
      header: "Kind",
      cell: (m) => <span className="text-small">{MOVEMENT_KIND_LABEL[m.kind]}</span>,
    },
    {
      key: "qty",
      header: "Qty",
      align: "right",
      cell: (m) => (
        <span className={cn("tabular", m.qty < 0 ? "text-danger" : "text-phase-completed")}>
          {m.qty > 0 ? "+" : ""}
          {m.qty} {unit}
        </span>
      ),
    },
    {
      key: "batch",
      header: "Batch",
      cell: (m) =>
        m.batch_id && m.batch_code ? (
          <BatchLink id={m.batch_id} code={m.batch_code} className="text-small" />
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    { key: "reason", header: "Reason", cell: (m) => <span className="text-small">{m.reason ?? "—"}</span> },
    {
      key: "who",
      header: "By",
      align: "right",
      cell: (m) =>
        m.actor_worker_id ? (
          <WorkerLink id={m.actor_worker_id} name={m.actor_worker_name} className="text-small" />
        ) : (
          <span className="text-small">{m.actor_user_name ?? "—"}</span>
        ),
    },
  ];
}

export default function LotPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: lot, isPending, isError } = useLot(id);
  const ledger = useLotMovements(id);

  if (isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (isError || !lot)
    return (
      <EmptyState
        icon={Boxes}
        title="Lot not found"
        action={
          <Button asChild variant="outline">
            <Link href="/materials">Back to materials</Link>
          </Button>
        }
      />
    );

  const unit = MATERIAL_UNIT_LABEL[lot.unit];
  const moves = ledger.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="space-y-8">
      <PageHeader
        mono
        crumbs={[
          { label: "Materials", href: "/materials" },
          { label: lot.type_name, href: `/materials?type=${lot.material_type_id}` },
        ]}
        title={lot.lot_code}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-foreground">{lot.type_name}</span>
            {lot.variant_name && <span>· {lot.variant_name}</span>}
            <span>· {lot.color}</span>
            {lot.supplier && <span>· {lot.supplier}</span>}
            {lot.unit_cost != null && (
              <span>
                · ₹{lot.unit_cost}/{unit}
              </span>
            )}
          </span>
        }
        actions={
          <>
            <Chip
              tone={
                lot.is_active
                  ? { text: "text-working", border: "border-working/30", dot: "bg-working" }
                  : { text: "text-muted-foreground", border: "border-border" }
              }
              dot={lot.is_active}
            >
              {lot.is_active ? "Active" : "Finished"}
            </Chip>
            <LotMovementDialog lot={lot} kind="adjust" />
            <LotMovementDialog lot={lot} kind="waste" />
            <LotMovementDialog lot={lot} kind="return" />
            <EditLotDialog
              lot={lot}
              hasConsumption={lot.consumed > 0 || lot.wasted > 0 || lot.returned > 0}
            />
          </>
        }
      />
      {lot.note && <p className="whitespace-pre-line text-small text-muted-foreground">✎ {lot.note}</p>}

      <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
        <Stat size="sm" value={lot.qty_remaining} of={lot.qty_received} label={`${unit} remaining`} />
        <Stat size="sm" value={lot.consumed} label={`${unit} used by batches`} />
        <Stat
          size="sm"
          value={lot.wasted}
          label={`${unit} wasted`}
          tone={lot.wasted ? "text-danger" : undefined}
        />
        <Stat
          size="sm"
          value={lot.adjusted > 0 ? `+${lot.adjusted}` : lot.adjusted}
          label={`${unit} adjusted`}
        />
        <Stat size="sm" value={lot.returned} label={`${unit} returned`} />
      </Card>

      <section className="space-y-3">
        <SectionTitle aside={`${lot.batches.length}`}>Batches</SectionTitle>
        <DataTable
          rows={lot.batches}
          columns={batchColumns(unit)}
          rowKey={(b) => b.batch_id}
          rowHref={(b) => `/batches/${b.batch_id}`}
          rowLabel={(b) => `Open batch ${b.batch_code}`}
          empty={<EmptyState title="No batch has used this lot yet" />}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle>Ledger</SectionTitle>
        {ledger.isError ? (
          <EmptyState title="Couldn't load the ledger" />
        ) : (
          <DataTable
            rows={moves}
            columns={movementColumns(unit)}
            rowKey={(m) => m.id}
            loading={ledger.isPending}
            empty={<EmptyState icon={History} title="No movements" />}
          />
        )}
        {ledger.hasNextPage && (
          <div className="flex justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => ledger.fetchNextPage()}
              disabled={ledger.isFetchingNextPage}
            >
              {ledger.isFetchingNextPage ? "Loading…" : "Load more"}
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
