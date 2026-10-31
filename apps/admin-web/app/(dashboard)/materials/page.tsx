"use client";

import { MATERIAL_UNIT_LABEL, type MaterialLotRow } from "@rps/shared";
import { Boxes } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiveLotDialog } from "@/features/materials/components/lot-dialogs";
import { MaterialsNav } from "@/features/materials/components/materials-nav";
import { useLots, useMaterialTypes } from "@/features/materials/hooks";
import { fmtAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const columns: Column<MaterialLotRow>[] = [
  {
    key: "lot",
    header: "Lot",
    card: "title",
    cell: (l) => (
      <div className={cn(!l.is_active && "opacity-60")}>
        <div className="font-mono text-small font-medium">{l.lot_code}</div>
        <div className="text-caption text-muted-foreground">{l.color}</div>
      </div>
    ),
  },
  {
    key: "type",
    header: "Material",
    cell: (l) => (
      <span className="text-small">
        {l.type_name}
        {l.variant_name && <span className="text-muted-foreground"> · {l.variant_name}</span>}
      </span>
    ),
  },
  {
    key: "remaining",
    header: "Remaining",
    width: "w-[200px]",
    cell: (l) => {
      const pct = l.qty_received > 0 ? Math.min(100, (l.qty_remaining / l.qty_received) * 100) : 0;
      return (
        <div className="space-y-1">
          <div className="tabular text-small">
            {l.qty_remaining}
            <span className="text-muted-foreground">
              {" "}
              / {l.qty_received} {MATERIAL_UNIT_LABEL[l.unit]}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", pct < 20 ? "bg-danger" : "bg-phase-completed")}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      );
    },
  },
  {
    key: "cost",
    header: "Cost",
    align: "right",
    cell: (l) =>
      l.unit_cost != null ? (
        <span className="tabular text-small">
          ₹{l.unit_cost}/{MATERIAL_UNIT_LABEL[l.unit]}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "moved",
    header: "Last movement",
    align: "right",
    card: "hide",
    cell: (l) => (
      <span className="text-caption text-muted-foreground">{fmtAgo(l.last_movement_at) ?? "—"}</span>
    ),
  },
];

function MaterialsStock() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const typeId = sp.get("type") ? Number(sp.get("type")) : undefined;
  const showAll = sp.get("all") === "1";
  const low = sp.get("low") === "1";
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.replace(n.toString() ? `${pathname}?${n}` : pathname, { scroll: false });
  };
  const { data: types } = useMaterialTypes();
  const {
    data: lots,
    isPending,
    isError,
  } = useLots({ type_id: typeId, active: showAll ? undefined : true, low: low || undefined });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Rolls, boxes and packs in stock — every change is in the ledger."
        actions={<ReceiveLotDialog defaultTypeId={typeId} />}
      />
      <MaterialsNav />

      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {(types ?? [])
          .filter((t) => t.is_active)
          .map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => set("type", typeId === t.id ? undefined : String(t.id))}
                aria-pressed={typeId === t.id}
                className={cn(
                  "w-full rounded-xl text-left focus-visible:outline-2 focus-visible:outline-brand",
                  typeId === t.id && "ring-2 ring-foreground/40",
                )}
              >
                <Card className="p-3 hover:bg-accent/60">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-small font-medium">{t.name}</span>
                    {t.is_low && <span className="text-caption text-danger">low</span>}
                  </div>
                  <div className="tabular mt-1 text-h2">
                    {t.stock_remaining}
                    <span className="text-small font-normal text-muted-foreground">
                      {" "}
                      {MATERIAL_UNIT_LABEL[t.unit]}
                    </span>
                  </div>
                  <div className="text-caption text-muted-foreground">
                    {t.active_lots} lot{t.active_lots === 1 ? "" : "s"}
                    {t.min_level != null && ` · min ${t.min_level}`}
                  </div>
                </Card>
              </button>
            </li>
          ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={typeId ? String(typeId) : "all"}
          onValueChange={(v) => set("type", v === "all" ? undefined : v)}
        >
          <SelectTrigger className="w-48" aria-label="Filter by material">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All materials</SelectItem>
            {(types ?? []).map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant={low ? "secondary" : "outline"}
          aria-pressed={low}
          onClick={() => set("low", low ? undefined : "1")}
        >
          Low stock only
        </Button>
        <Button
          type="button"
          size="sm"
          variant={showAll ? "secondary" : "outline"}
          aria-pressed={showAll}
          onClick={() => set("all", showAll ? undefined : "1")}
        >
          Include finished lots
        </Button>
      </div>

      {isError ? (
        <EmptyState title="Couldn't load lots" body="Check the backend is running, then reload." />
      ) : (
        <DataTable
          rows={lots ?? []}
          columns={columns}
          rowKey={(l) => l.id}
          rowHref={(l) => `/materials/lots/${l.id}`}
          rowLabel={(l) => `Open lot ${l.lot_code}`}
          loading={isPending}
          empty={
            <EmptyState
              icon={Boxes}
              title={low ? "Nothing below its minimum" : "No lots"}
              body={
                low
                  ? "Set a minimum on a material type to get low-stock warnings."
                  : "Receive the first roll or pack."
              }
            />
          }
        />
      )}
    </div>
  );
}

export default function MaterialsPage() {
  return (
    <Suspense fallback={null}>
      <MaterialsStock />
    </Suspense>
  );
}
