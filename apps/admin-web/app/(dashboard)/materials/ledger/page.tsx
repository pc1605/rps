"use client";

import { MATERIAL_UNIT_LABEL, MOVEMENT_KIND_LABEL, type MaterialMovementRow } from "@rps/shared";
import { History } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { BatchLink, LotLink, WorkerLink } from "@/components/rps/entity-link";
import { PageHeader } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MaterialsNav } from "@/features/materials/components/materials-nav";
import { useMaterialTypes, useMovements } from "@/features/materials/hooks";
import { fmtStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

const columns: Column<MaterialMovementRow>[] = [
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
    cell: (m) => (
      <span className={cn("text-small", !m.lot_id && "text-danger")}>
        {m.lot_id ? MOVEMENT_KIND_LABEL[m.kind] : "Shortfall"}
      </span>
    ),
  },
  {
    key: "qty",
    header: "Qty",
    align: "right",
    cell: (m) => (
      <span className={cn("tabular", m.qty < 0 ? "text-danger" : "text-phase-completed")}>
        {m.qty > 0 ? "+" : ""}
        {m.qty} {MATERIAL_UNIT_LABEL[m.unit]}
      </span>
    ),
  },
  {
    key: "material",
    header: "Material",
    cell: (m) => (
      <span className="text-small">
        {m.type_name}
        {m.variant_name && <span className="text-muted-foreground"> · {m.variant_name}</span>}
      </span>
    ),
  },
  {
    key: "lot",
    header: "Lot",
    cell: (m) => <LotLink id={m.lot_id} code={m.lot_code ?? "—"} className="text-small" />,
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
    key: "by",
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

function Ledger() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const set = (k: string, v?: string) => {
    const n = new URLSearchParams(sp.toString());
    if (v) n.set(k, v);
    else n.delete(k);
    router.replace(n.toString() ? `${pathname}?${n}` : pathname, { scroll: false });
  };
  const typeId = sp.get("type") ? Number(sp.get("type")) : undefined;
  const from = sp.get("from") ?? undefined;
  const to = sp.get("to") ?? undefined;
  const { data: types } = useMaterialTypes();
  const q = useMovements({ type_id: typeId, from, to });
  const rows = q.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Every receive, use, adjustment, waste and return — newest first."
      />
      <MaterialsNav />
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
        <Label htmlFor="ledger-from" className="sr-only">
          From
        </Label>
        <Input
          id="ledger-from"
          type="date"
          value={from ?? ""}
          onChange={(e) => set("from", e.target.value || undefined)}
          className="w-38"
        />
        <span className="text-muted-foreground" aria-hidden>
          →
        </span>
        <Label htmlFor="ledger-to" className="sr-only">
          To
        </Label>
        <Input
          id="ledger-to"
          type="date"
          value={to ?? ""}
          onChange={(e) => set("to", e.target.value || undefined)}
          className="w-38"
        />
      </div>
      {q.isError ? (
        <EmptyState title="Couldn't load the ledger" />
      ) : (
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(m) => m.id}
          loading={q.isPending}
          empty={<EmptyState icon={History} title="No movements" body="Nothing in this range." />}
        />
      )}
      {q.hasNextPage && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={() => q.fetchNextPage()}
            disabled={q.isFetchingNextPage}
          >
            {q.isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      )}
    </div>
  );
}

export default function LedgerPage() {
  return (
    <Suspense fallback={null}>
      <Ledger />
    </Suspense>
  );
}
