"use client";

import type { CarOverviewBatch } from "@rps/shared";
import { Car, Package, Pencil } from "lucide-react";
import Link from "next/link";
import { use, useState } from "react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { BatchLink } from "@/components/rps/entity-link";
import { PageHeader, SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CarMaterials } from "@/features/catalog/components/car-materials";
import { ItemDialog } from "@/features/catalog/components/item-dialog";
import { useCarOverview } from "@/features/catalog/hooks";
import type { CarItem } from "@/features/catalog/types";
import {
  type DateRange,
  defaultRange,
  presetRanges,
  RangePicker,
} from "@/features/reports/components/range-picker";
import { batchTone, sizeLabel } from "@/lib/tokens";

const batchColumns: Column<CarOverviewBatch>[] = [
  {
    key: "code",
    header: "Batch",
    card: "title",
    cell: (b) => <BatchLink id={b.id} code={b.batch_code} className="text-small" />,
  },
  {
    key: "phase",
    header: "Phase",
    cell: (b) => {
      const tone = batchTone(b.current_phase, b.status);
      return (
        <Chip tone={tone} dot>
          {tone.label}
        </Chip>
      );
    },
  },
  {
    key: "packed",
    header: "Packed",
    align: "right",
    cell: (b) => (
      <span className="tabular">
        {b.units_packed}
        <span className="text-muted-foreground"> / {b.quantity}</span>
      </span>
    ),
  },
  {
    key: "rework",
    header: "Rework open",
    align: "right",
    cell: (b) =>
      b.rework_open ? (
        <span className="tabular text-danger">{b.rework_open}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "created",
    header: "Created",
    align: "right",
    cell: (b) => (
      <time dateTime={b.created_at} className="tabular text-caption text-muted-foreground">
        {new Date(b.created_at).toLocaleDateString()}
      </time>
    ),
  },
];

const last30 = (): DateRange => presetRanges().find((r) => r.label === "Last 30 days") ?? defaultRange();

export default function CarPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: raw } = use(params);
  const id = Number(raw);
  const [range, setRange] = useState<DateRange>(last30);
  const { data, isPending, isError } = useCarOverview(id, range.from, range.to);

  if (isPending)
    return (
      <div className="space-y-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  if (isError || !data)
    return (
      <EmptyState
        icon={Car}
        title="Item not found"
        action={
          <Button asChild variant="outline">
            <Link href="/cars">Back to cars</Link>
          </Button>
        }
      />
    );

  const { car, stats: s } = data;
  return (
    <div className="space-y-8">
      <PageHeader
        crumbs={[{ label: "Cars", href: "/cars" }]}
        title={`${car.brand_name} ${car.name}`}
        description={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>
              {sizeLabel[car.size_class] ?? car.size_class}
              {car.line_name ? ` · ${car.line_name}` : ""} · {car.pieces_per_set} pieces · group{" "}
              <span className="text-foreground">{car.consumption_group_name}</span>
            </span>
            {car.barcode && <span className="font-mono text-small">▮ {car.barcode}</span>}
          </span>
        }
        actions={
          <>
            <ItemDialog
              item={{ ...car, id: car.id } as CarItem}
              trigger={
                <Button type="button" variant="outline">
                  <Pencil className="h-4 w-4" aria-hidden /> Edit
                </Button>
              }
            />
            <Chip
              tone={
                car.is_active
                  ? { text: "text-working", border: "border-working/30", dot: "bg-working" }
                  : { text: "text-muted-foreground", border: "border-border" }
              }
              dot={car.is_active}
            >
              {car.is_active ? "Active" : "Inactive"}
            </Chip>
          </>
        }
      />

      <section className="space-y-4">
        <SectionTitle>Output & quality</SectionTitle>
        <RangePicker value={range} onChange={setRange} />
        <Card className="flex flex-wrap gap-x-12 gap-y-4 p-5">
          <Stat size="sm" value={s.stitched} label="mats stitched" />
          <Stat size="sm" value={s.packed} label="mats packed" />
          <Stat
            size="sm"
            value={s.rework_rate != null ? `${s.rework_rate}%` : "—"}
            label={`rework rate · ${s.rework_rounds} round${s.rework_rounds === 1 ? "" : "s"}`}
            tone={s.rework_rounds ? "text-danger" : undefined}
          />
          <Stat size="sm" value={s.first_pass != null ? `${s.first_pass}%` : "—"} label="first-pass yield" />
          <Stat size="sm" value={s.in_wip} label="mats in production now" />
          <Stat size="sm" value={s.in_stock} label="in stockyard now" />
        </Card>
      </section>

      <CarMaterials carId={car.id} carName={`${car.brand_name} ${car.name}`} lineId={car.product_line_id} />

      <section className="space-y-3">
        <SectionTitle aside={`${data.active_batches.length}`}>Active batches</SectionTitle>
        <DataTable
          rows={data.active_batches}
          columns={batchColumns}
          rowKey={(b) => b.id}
          rowHref={(b) => `/batches/${b.id}`}
          rowLabel={(b) => `Open batch ${b.batch_code}`}
          empty={<EmptyState icon={Package} title="No batches in production for this item" />}
        />
      </section>

      <section className="space-y-3">
        <SectionTitle>Recently completed</SectionTitle>
        <DataTable
          rows={data.recent_completed}
          columns={batchColumns}
          rowKey={(b) => b.id}
          rowHref={(b) => `/batches/${b.id}`}
          rowLabel={(b) => `Open batch ${b.batch_code}`}
          empty={<EmptyState icon={Package} title="Nothing completed yet" />}
        />
      </section>
    </div>
  );
}
