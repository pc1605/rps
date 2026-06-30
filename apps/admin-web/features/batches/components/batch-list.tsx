"use client";

import Link from "next/link";
import { useBatches } from "../hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Batch, Phase } from "../types";

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

const columns: Column[] = [
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
    width: "w-[130px]",
    cell: (b) => (
      <Badge
        variant="outline"
        className={cn(
          "font-mono text-[10px] uppercase",
          phaseStyle[b.current_phase],
        )}
      >
        {b.current_phase}
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

export function BatchList() {
  const { data: batches, isLoading, error } = useBatches();

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
