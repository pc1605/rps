"use client";

import { Package, Printer } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { Button } from "@/components/ui/button";
import { batchTone, sizeLabel } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { batchApi } from "../api";
import { useBatches, useMarkStickersPrinted } from "../hooks";
import { generateLabelPdf } from "../label-pdf";
import type { Batch } from "../types";
import { batchViews } from "../views";

const baseColumns: Column<Batch>[] = [
  {
    key: "code",
    header: "Code",
    width: "w-[180px]",
    card: "title",
    cell: (b) => (
      <div>
        <Link href={`/batches/${b.id}`} className="font-mono text-small text-brand hover:underline">
          {b.batch_code}
        </Link>
        {b.status === "awaiting_assignment" && b.cut_qty < b.quantity && (
          <span className="ml-2 text-caption text-brand" title={`${b.cut_qty} of ${b.quantity} cut`}>
            ⚠ short
          </span>
        )}
        {b.parent_batch_code && (
          <div className="text-caption text-muted-foreground">↩ from {b.parent_batch_code}</div>
        )}
      </div>
    ),
  },
  {
    key: "model",
    header: "Model",
    cell: (b) => (
      <div>
        <div className="font-medium">
          {b.brand_name} {b.model_name}
        </div>
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
    align: "center",
    width: "w-[70px]",
    cell: (b) => <span className="tabular">{b.quantity}</span>,
  },
  {
    key: "phase",
    header: "Phase",
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
      </span>
    ),
  },
  {
    key: "created",
    header: "Created",
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

export function BatchList() {
  const params = useSearchParams();
  const phase = params.get("phase");
  const view = batchViews.find((v) => v.key === phase);
  const { data: batches, isPending, isError } = useBatches();
  const markPrinted = useMarkStickersPrinted();

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

  if (isError)
    return <EmptyState title="Couldn't load batches" body="Check the backend is running, then reload." />;

  const all = batches ?? [];
  const visible = view ? all.filter(view.filter) : all;
  const columns = view?.key === "packing" ? [...baseColumns, stickerColumn] : baseColumns;

  return (
    <div className="space-y-3">
      {view && (
        <div className="flex items-center gap-2 text-small text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", view.dot)} aria-hidden />
          {view.label} · <span className="tabular">{visible.length}</span>
        </div>
      )}
      <DataTable
        rows={visible}
        columns={columns}
        rowKey={(b) => b.id}
        loading={isPending}
        empty={
          <EmptyState
            icon={Package}
            title={view ? `Nothing in ${view.label.toLowerCase()}` : "No batches yet"}
            body={
              view
                ? "Batches show up here as they reach this stage."
                : "Create the first order and it appears here and on the dashboard pipeline."
            }
          />
        }
      />
    </div>
  );
}
