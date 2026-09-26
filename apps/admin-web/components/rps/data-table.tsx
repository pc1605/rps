"use client";

import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type Align = "left" | "center" | "right";

export interface Column<T> {
  key: string;
  header: string;
  align?: Align;
  width?: string;
  cell: (row: T) => React.ReactNode;
  /** Card mode (< md): "title" renders as the card heading; "hide" omits it. */
  card?: "title" | "hide";
}

const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (r: T) => void;
}) {
  if (loading) return <DataTableSkeleton cols={columns.length} />;
  if (!rows.length)
    return (
      <>
        {empty ?? (
          <Card className="border-dashed p-10 text-center text-small text-muted-foreground">
            Nothing here.
          </Card>
        )}
      </>
    );

  const title = columns.find((c) => c.card === "title") ?? columns[0];
  if (!title) return null;
  const rest = columns.filter((c) => c !== title && c.card !== "hide");

  return (
    <>
      {/* ≥ md: table */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead
                  key={c.key}
                  className={cn(
                    "h-11 px-4 text-caption font-medium text-muted-foreground",
                    alignClass[c.align ?? "left"],
                    c.width,
                  )}
                >
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={rowKey(r)}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn("px-4 py-3.5", alignClass[c.align ?? "left"])}>
                    {c.cell(r)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* < md: stacked cards */}
      <ul className="space-y-2 md:hidden">
        {rows.map((r) => (
          <li key={rowKey(r)}>
            <Card
              className={cn("p-4", onRowClick && "active:bg-accent")}
              onClick={onRowClick ? () => onRowClick(r) : undefined}
            >
              <div className="mb-3">{title.cell(r)}</div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {rest.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-caption text-muted-foreground">{c.header}</dt>
                    <dd className="truncate text-small">{c.cell(r)}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function DataTableSkeleton({ cols = 5, rows = 6 }: { cols?: number; rows?: number }) {
  return (
    <Card className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: Math.min(cols, 5) }).map((_, j) => (
            <Skeleton key={j} className={cn("h-5", j === 0 ? "w-32" : "flex-1")} />
          ))}
        </div>
      ))}
    </Card>
  );
}
