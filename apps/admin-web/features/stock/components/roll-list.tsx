"use client";

import { useRollsStock } from "../hooks";
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
import { StockBar } from "./stock-bar";
import { RollActions } from "./roll-actions";
import type { Roll } from "../types";

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
  cell: (r: Roll) => React.ReactNode;
}

const columns: Column[] = [
  {
    key: "code",
    header: "Roll",
    align: "left",
    width: "w-[110px]",
    cell: (r) => (
      <span
        className={cn(
          "font-mono text-sm font-semibold",
          r.is_active ? "text-primary" : "text-muted-foreground line-through",
        )}
      >
        {r.roll_code}
      </span>
    ),
  },
  {
    key: "color",
    header: "Color",
    align: "left",
    width: "w-[160px]",
    cell: (r) => <span className="font-medium">{r.color}</span>,
  },
  {
    key: "stock",
    header: "Stock",
    align: "left",
    cell: (r) => (
      <StockBar
        total={r.total_meters}
        remaining={r.remaining_meters}
        low={r.is_low}
      />
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "center",
    width: "w-[120px]",
    cell: (r) => {
      if (!r.is_active)
        return (
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Finished
          </Badge>
        );
      if (r.is_low)
        return (
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase text-red-600 dark:text-red-400 border-red-500/30"
          >
            ⚠ Low
          </Badge>
        );
      return (
        <Badge
          variant="outline"
          className="font-mono text-[10px] uppercase text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
        >
          Active
        </Badge>
      );
    },
  },
  {
    key: "batches",
    header: "Batches",
    align: "center",
    width: "w-[90px]",
    cell: (r) => (
      <span className="font-mono tabular-nums text-muted-foreground">
        {r.batch_count}
      </span>
    ),
  },
  {
    key: "actions",
    header: "",
    align: "right",
    width: "w-[60px]",
    cell: (r) => <RollActions roll={r} />,
  },
];

export function RollList() {
  const { data: rolls, isLoading, error } = useRollsStock();

  if (isLoading)
    return (
      <p className="font-mono text-sm text-muted-foreground">Loading stock…</p>
    );
  if (error)
    return (
      <p className="font-mono text-sm text-destructive">
        Failed to load rolls.
      </p>
    );
  if (!rolls?.length)
    return (
      <Card className="p-12 text-center text-muted-foreground text-sm">
        No rolls yet. Add your first rexine roll.
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
          {rolls.map((r) => (
            <TableRow key={r.id} className={cn(!r.is_active && "opacity-60")}>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn("px-4 py-4", alignClass[col.align])}
                >
                  {col.cell(r)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
