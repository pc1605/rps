"use client";

import { Car, Pencil, Search } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ItemDialog } from "@/features/catalog/components/item-dialog";
import { useCarItems, useUpdateItem } from "@/features/catalog/hooks";
import type { CarItem } from "@/features/catalog/types";
import { sizeLabel } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const neutral = { text: "text-muted-foreground", border: "border-border" };

export default function CarsPage() {
  const { data: items, isPending } = useCarItems();
  const update = useUpdateItem();
  const [q, setQ] = useState("");

  const visible = (items ?? []).filter((i) =>
    `${i.brand_name} ${i.name} ${i.size_class} ${i.line_name ?? ""} ${i.barcode ?? ""}`
      .toLowerCase()
      .includes(q.toLowerCase()),
  );

  const columns: Column<CarItem>[] = [
    {
      key: "item",
      header: "Item",
      card: "title",
      cell: (i) => (
        <div className={cn(!i.is_active && "opacity-50")}>
          <div className="font-medium">
            {i.brand_name} {i.name}
          </div>
          <div className="text-caption text-muted-foreground">{i.line_name ?? "No product line"}</div>
        </div>
      ),
    },
    {
      key: "size",
      header: "Size",
      align: "center",
      width: "w-[80px]",
      cell: (i) => <Chip tone={neutral}>{sizeLabel[i.size_class] ?? i.size_class}</Chip>,
    },
    {
      key: "pieces",
      header: "Pieces",
      align: "center",
      width: "w-[80px]",
      cell: (i) => <span className="tabular">{i.pieces_per_set}</span>,
    },
    {
      key: "barcode",
      header: "Barcode",
      cell: (i) => <span className="font-mono text-small">{i.barcode ?? "—"}</span>,
    },
    {
      key: "active",
      header: "Active",
      align: "center",
      width: "w-[80px]",
      cell: (i) => (
        <Switch
          checked={i.is_active}
          onCheckedChange={(v) => update.mutate({ id: i.id, is_active: v })}
          aria-label={`${i.is_active ? "Deactivate" : "Activate"} ${i.brand_name} ${i.name}`}
        />
      ),
    },
    {
      key: "edit",
      header: "",
      align: "right",
      width: "w-[60px]",
      cell: (i) => (
        <ItemDialog
          item={i}
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Edit ${i.brand_name} ${i.name}`}>
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cars"
        description="Items you make: car, size, product line and barcode."
        actions={<ItemDialog />}
      />

      <div className="relative max-w-sm">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search brand, model, line, barcode…"
          className="pl-8"
          aria-label="Search items"
        />
      </div>

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(i) => String(i.id)}
        loading={isPending}
        empty={
          q ? (
            <EmptyState
              icon={Search}
              title="No items match"
              body={`Nothing matches “${q}”. Try a brand, model or barcode.`}
            />
          ) : (
            <EmptyState
              icon={Car}
              title="No items yet"
              body="Add the cars you make, one row per product line."
              action={<ItemDialog />}
            />
          )
        }
      />
    </div>
  );
}
