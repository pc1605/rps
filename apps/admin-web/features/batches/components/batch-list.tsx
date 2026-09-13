"use client";

import Link from "next/link";
import { Printer } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useBatches, useMarkStickersPrinted } from "../hooks";
import { generateLabelPdf } from "../label-pdf";
import { batchApi } from "../api";
import type { Batch, Phase } from "../types";
import { useSearchParams } from "next/navigation";
import { batchViews } from "../views";

const phaseStyle: Record<Phase, string> = {
  cutting: "text-cyan-600 dark:text-cyan-400 border-cyan-500/30",
  stitching: "text-pink-600 dark:text-pink-400 border-pink-500/30",
  packing: "text-amber-600 dark:text-amber-400 border-amber-500/30",
  completed: "text-lime-600 dark:text-lime-400 border-lime-500/30",
};

const sizeStyle: Record<string, string> = {
  small: "text-cyan-600 dark:text-cyan-400",
  medium: "text-amber-600 dark:text-amber-400",
  large: "text-pink-600 dark:text-pink-400",
};

type Align = "left" | "center" | "right";
const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

interface Column {
  key: string;
  header: string;
  align: Align;
  width?: string;
  cell: (b: Batch) => React.ReactNode;
}

const baseColumns: Column[] = [
  {
    key: "code",
    header: "Code",
    align: "left",
    width: "w-[130px]",
    cell: (b) => (
      <Link
        href={`/batches/${b.id}`}
        className="font-mono text-sm text-amber-600 dark:text-amber-400 hover:underline"
      >
        {b.batch_code}
      </Link>
    ),
  },
  {
    key: "model",
    header: "Model",
    align: "left",
    cell: (b) => (
      <div>
        <div className="font-medium">
          {b.brand_name} {b.model_name}
        </div>
        <div
          className={cn(
            "font-mono text-[10px] uppercase",
            sizeStyle[b.size_class],
          )}
        >
          {b.size_class}
        </div>
      </div>
    ),
  },
  {
    key: "qty",
    header: "Qty",
    align: "center",
    width: "w-[80px]",
    cell: (b) => <span className="font-mono tabular-nums">{b.quantity}</span>,
  },
  {
    key: "phase",
    header: "Phase",
    align: "center",
    width: "w-[150px]",
    cell: (b) => (
      <Badge
        variant="outline"
        className={cn(
          "font-mono text-[10px] uppercase",
          b.status === "awaiting_assignment"
            ? "text-amber-600 dark:text-amber-400 border-amber-500/30"
            : phaseStyle[b.current_phase],
        )}
      >
        {b.status === "awaiting_assignment" ? "ready" : b.current_phase}
      </Badge>
    ),
  },
  {
    key: "packed",
    header: "Packed",
    align: "center",
    width: "w-[100px]",
    cell: (b) => (
      <span className="font-mono tabular-nums text-muted-foreground">
        {b.units_packed}/{b.units_total}
      </span>
    ),
  },
  {
    key: "created",
    header: "Created",
    align: "right",
    width: "w-[120px]",
    cell: (b) => (
      <span className="font-mono text-[11px] text-muted-foreground">
        {new Date(b.created_at).toLocaleDateString()}
      </span>
    ),
  },
];

function BatchTable({
  batches,
  columns,
}: {
  batches: Batch[];
  columns: Column[];
}) {
  if (!batches.length)
    return (
      <Card className="p-10 text-center text-muted-foreground text-sm">
        Nothing here right now.
      </Card>
    );

  return (
    <Card className="overflow-hidden p-0">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead
                key={col.key}
                className={cn(
                  "h-11 px-4 font-mono text-[10px] uppercase tracking-wider",
                  alignClass[col.align],
                  col.width,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((b) => (
            <TableRow key={b.id}>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn("px-4 py-4", alignClass[col.align])}
                >
                  {col.cell(b)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

export function BatchList() {
  const params = useSearchParams();
  const phase = params.get("phase");
  const view = batchViews.find((v) => v.key === phase);
  const { data: batches, isLoading, error } = useBatches();
  const markPrinted = useMarkStickersPrinted();

  if (isLoading)
    return (
      <p className="font-mono text-sm text-muted-foreground">
        Loading batches…
      </p>
    );
  if (error)
    return (
      <p className="font-mono text-sm text-destructive">
        Failed to load batches.
      </p>
    );
  if (!batches?.length)
    return (
      <Card className="p-12 text-center text-muted-foreground text-sm">
        No batches yet. Create your first one.
      </Card>
    );

  const printStickers = async (b: Batch) => {
    const detail = await batchApi.get(b.id);
    await generateLabelPdf(detail, "sticker");
    markPrinted.mutate(b.id);
  };

  // Packing tab gets an extra actions column
  const stickerColumn: Column = {
    key: "stickers",
    header: "Stickers",
    align: "right",
    width: "w-[170px]",
    cell: (b) => (
      <Button variant="outline" size="sm" onClick={() => printStickers(b)}>
        <Printer className="h-3.5 w-3.5" />
        {b.stickers_printed_at ? "Reprint" : "Print stickers"}
      </Button>
    ),
  };

  const visible = view ? batches.filter(view.filter) : batches;
  const columns =
    view?.key === "packing" ? [...baseColumns, stickerColumn] : baseColumns;

  return (
    <div className="space-y-3">
      {view && (
        <div className="flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
          <span className={cn("h-2 w-2 rounded-full", view.dot)} />
          {view.label} · {visible.length}
        </div>
      )}
      <BatchTable batches={visible} columns={columns} />
    </div>
  );
}
