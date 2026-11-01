"use client";

import type { BatchSort } from "@rps/shared";
import { ChevronLeft, ChevronRight, Package, Printer, Search, UserPlus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { Button } from "@/components/ui/button";
import { batchTone, sizeLabel } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { batchApi } from "../api";
import { useBatchPage, useMarkStickersPrinted } from "../hooks";
import { PAGE_SIZE, useListParams } from "../use-list-params";
import { AssignSheet, waitingFor } from "./assign-sheet";
import { BatchFilters } from "./batch-filters";
import { generateLabelPdf } from "../label-pdf";
import type { Batch } from "../types";
import { batchViews } from "../views";
import { CarLink } from "@/components/rps/entity-link";

const baseColumns: Column<Batch>[] = [
  {
    key: "code",
    header: "Code",
    sortKey: "code",
    width: "w-[180px]",
    card: "title",
    cell: (b) => (
      <div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={`/batches/${b.id}`} className="font-mono text-small text-brand hover:underline">
            {b.batch_code}
          </Link>
          {(b.rework_open ?? 0) > 0 && (
            <Chip
              tone={{
                text: "text-danger",
                border: "border-danger/30",
                bg: "bg-danger/10",
              }}
            >
              🔧 {b.rework_open}
            </Chip>
          )}
          {b.status === "awaiting_assignment" && b.cut_qty < b.quantity && (
            <span className="text-caption text-brand" title={`${b.cut_qty} of ${b.quantity} cut`}>
              ⚠ short
            </span>
          )}
        </div>
        {b.parent_batch_code && (
          <div className="text-caption text-muted-foreground">↩ from {b.parent_batch_code}</div>
        )}
      </div>
    ),
  },
  {
    key: "model",
    header: "Model",
    sortKey: "car",
    cell: (b) => (
      <div>
        <CarLink id={b.car_model_id} className="font-medium">
          {b.brand_name} {b.model_name}
        </CarLink>
        <div className="text-caption text-muted-foreground">
          {sizeLabel[b.size_class] ?? b.size_class}
          {b.line_name ? ` · ${b.line_name}` : ""}
        </div>
      </div>
    ),
  },
  {
    key: "qty",
    header: "Qty",
    sortKey: "quantity",
    align: "center",
    width: "w-[70px]",
    cell: (b) => <span className="tabular">{b.quantity}</span>,
  },
  {
    key: "phase",
    header: "Phase",
    sortKey: "phase",
    align: "center",
    width: "w-[170px]",
    cell: (b) => {
      const tone = batchTone(b.current_phase, b.status);
      return (
        <div className="flex flex-col items-center gap-1 md:items-center">
          <Chip tone={tone} dot>
            {tone.label}
          </Chip>
          {b.active_workers && (
            <span className="text-caption text-muted-foreground">👤 {b.active_workers}</span>
          )}
        </div>
      );
    },
  },
  {
    key: "progress",
    header: "Stitched / Packed",
    align: "center",
    width: "w-[140px]",
    cell: (b) => (
      <span className="tabular text-muted-foreground">
        {b.units_stitched ?? 0} · {b.units_packed}
        <span className="text-muted-foreground/60"> / {b.units_total}</span>
        {b.units_written_off > 0 && (
          <span className="block text-caption text-danger">{b.units_written_off} written off</span>
        )}
      </span>
    ),
  },
  {
    key: "created",
    header: "Created",
    sortKey: "created",
    align: "right",
    width: "w-[110px]",
    card: "hide",
    cell: (b) => (
      <time dateTime={b.created_at} className="tabular text-caption text-muted-foreground">
        {new Date(b.created_at).toLocaleDateString()}
      </time>
    ),
  },
];

// Ready to stitch (U3): an assigning screen — car large, mats, waiting time, Assign.
const isShort = (b: Batch) => b.status === "awaiting_assignment" && b.cut_qty < b.quantity;

function readyColumns(onAssign: (b: Batch) => void): Column<Batch>[] {
  return [
    {
      key: "model",
      header: "Car",
      sortKey: "car",
      card: "title",
      cell: (b) => (
        <div>
          <div className="text-h2">
            {b.brand_name} {b.model_name}
          </div>
          <div className="text-caption text-muted-foreground">
            <Link href={`/batches/${b.id}`} className="font-mono hover:underline">
              {b.batch_code}
            </Link>
            {" · "}
            {sizeLabel[b.size_class] ?? b.size_class}
            {b.line_name ? ` · ${b.line_name}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "qty",
      header: "Mats",
      sortKey: "quantity",
      align: "center",
      width: "w-[90px]",
      cell: (b) => <span className="text-h2 tabular">{b.quantity}</span>,
    },
    {
      key: "waiting",
      header: "Waiting",
      sortKey: "waiting",
      align: "center",
      width: "w-[120px]",
      cell: (b) => <span className="tabular text-muted-foreground">{waitingFor(b.ready_since) ?? "—"}</span>,
    },
    {
      key: "assign",
      header: "",
      align: "right",
      width: "w-[200px]",
      cell: (b) =>
        isShort(b) ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`/batches/${b.id}`} title={`${b.cut_qty} of ${b.quantity} cut`}>
              Resolve short cut
            </Link>
          </Button>
        ) : (
          <Button type="button" size="lg" onClick={() => onAssign(b)}>
            <UserPlus aria-hidden /> Assign
          </Button>
        ),
    },
  ];
}

// Default direction when a column is first sorted.
const firstOrder: Record<BatchSort, "asc" | "desc"> = {
  created: "desc",
  quantity: "desc",
  code: "asc",
  car: "asc",
  phase: "asc",
  waiting: "asc",
};

export function BatchList() {
  const { state, params, set, filtered } = useListParams();
  const view = batchViews.find((v) => v.key === state.phase);
  const { data, isPending, isError, isPlaceholderData } = useBatchPage(params);
  const markPrinted = useMarkStickersPrinted();
  // Assign panel: keep the last batch while the sheet animates closed.
  const [assigning, setAssigning] = useState<Batch | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const openAssign = (b: Batch) => {
    setAssigning(b);
    setAssignOpen(true);
  };

  const printStickers = async (b: Batch) => {
    try {
      const detail = await batchApi.get(b.id);
      await generateLabelPdf(detail, "sticker");
      markPrinted.mutate(b.id);
      toast.success(`Stickers for ${b.batch_code} ready to print`);
    } catch (e) {
      toast.error("Couldn't generate stickers", {
        description: (e as Error).message,
      });
    }
  };

  const stickerColumn: Column<Batch> = {
    key: "stickers",
    header: "Stickers",
    align: "right",
    width: "w-[160px]",
    cell: (b) => (
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          printStickers(b);
        }}
      >
        <Printer className="h-3.5 w-3.5" />
        {b.stickers_printed_at ? "Reprint" : "Print stickers"}
      </Button>
    ),
  };

  const sortKey = params.sort ?? "created";
  const order = params.order ?? (params.sort ? firstOrder[params.sort] : "desc");
  const onSort = (key: string) => {
    const k = key as BatchSort;
    if (k === sortKey) set({ sort: k, order: order === "asc" ? "desc" : "asc" });
    else set({ sort: k, order: firstOrder[k] });
  };

  const columns =
    view?.key === "packing"
      ? [...baseColumns, stickerColumn]
      : view?.key === "ready"
        ? readyColumns(openAssign)
        : baseColumns;
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const page = params.page ?? 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const firstRow = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(total, page * PAGE_SIZE);

  return (
    <div className="space-y-3">
      <BatchFilters state={state} set={set} filtered={filtered} />
      {view && (
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", view.dot)} aria-hidden />
          {view.label} · <span className="tabular">{total}</span>
        </div>
      )}
      {isError ? (
        <EmptyState title="Couldn't load batches" body="Check the backend is running, then reload." />
      ) : (
        <div className={cn("transition-opacity", isPlaceholderData && "opacity-60")}>
          <DataTable
            rows={items}
            columns={columns}
            rowKey={(b) => b.id}
            rowHref={(b) => `/batches/${b.id}`}
            rowLabel={(b) => `Open batch ${b.batch_code}`}
            loading={isPending}
            sort={{ key: sortKey, order }}
            onSort={onSort}
            empty={
              filtered ? (
                <EmptyState
                  icon={Search}
                  title="No batches match"
                  body="Try fewer filters or another search."
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        set({
                          q: undefined,
                          car: undefined,
                          line: undefined,
                          from: undefined,
                          to: undefined,
                          rework: undefined,
                          short: undefined,
                        })
                      }
                    >
                      Clear filters
                    </Button>
                  }
                />
              ) : (
                <EmptyState
                  icon={Package}
                  title={view ? `Nothing in ${view.label.toLowerCase()}` : "No batches yet"}
                  body={
                    view
                      ? "Batches show up here as they reach this stage."
                      : "Create the first batch and it appears here and on the dashboard pipeline."
                  }
                />
              )
            }
          />
        </div>
      )}
      {total > PAGE_SIZE && (
        <nav className="flex items-center justify-between gap-3" aria-label="Pagination">
          <span className="tabular text-small text-muted-foreground">
            {firstRow}–{lastRow} of {total}
          </span>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => set({ page: page - 1 > 1 ? String(page - 1) : undefined })}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden /> Prev
            </Button>
            <span className="tabular text-small">
              {page} / {pages}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onClick={() => set({ page: String(page + 1) })}
            >
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        </nav>
      )}
      <AssignSheet
        batchId={assigning?.id ?? null}
        readySince={assigning?.ready_since}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      />
    </div>
  );
}
