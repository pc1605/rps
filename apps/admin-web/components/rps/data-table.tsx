"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
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
  /** Makes the header a sort button (server-side sort key). */
  sortKey?: string;
}

export type SortState = { key: string; order: "asc" | "desc" };

const alignClass: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

// Clicks on these (or anything rendered in a portal, e.g. a dialog opened from the row) never trigger the row.
const INTERACTIVE =
  'a,button,input,select,textarea,label,[role="switch"],[role="checkbox"],[role="menuitem"],[data-row-ignore]';

function rowActivator<T>(
  row: T,
  rowHref: ((r: T) => string) | undefined,
  onRowClick: ((r: T) => void) | undefined,
  push: (href: string) => void,
) {
  return (e: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (!e.currentTarget.contains(target)) return; // portal content bubbling through React
    const hit = target.closest(INTERACTIVE);
    if (hit && e.currentTarget.contains(hit) && hit !== e.currentTarget) return;
    if ("key" in e) {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
    }
    if (rowHref) {
      const href = rowHref(row);
      const newTab = "button" in e && (e.metaKey || e.ctrlKey || e.button === 1);
      if (newTab) window.open(href, "_blank", "noopener");
      else push(href);
    } else onRowClick?.(row);
  };
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  loading,
  empty,
  onRowClick,
  rowHref,
  sort,
  onSort,
  rowLabel,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (r: T) => void;
  /** Whole row opens this page (ctrl/⌘/middle-click → new tab). Preferred over onRowClick. */
  rowHref?: (r: T) => string;
  sort?: SortState;
  onSort?: (key: string) => void;
  /** Accessible name for a clickable row, e.g. "Open batch B-2026-004". */
  rowLabel?: (r: T) => string;
}) {
  const router = useRouter();
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

  const clickable = !!(rowHref || onRowClick);
  const title = columns.find((c) => c.card === "title") ?? columns[0];
  if (!title) return null;
  const rest = columns.filter((c) => c !== title && c.card !== "hide");
  const rowProps = (r: T) => {
    if (!clickable) return {};
    const act = rowActivator(r, rowHref, onRowClick, router.push);
    return {
      tabIndex: 0,
      role: "link" as const,
      "aria-label": rowLabel?.(r),
      onClick: act,
      onAuxClick: (e: React.MouseEvent<HTMLElement>) => e.button === 1 && act(e),
      onKeyDown: act,
    };
  };

  return (
    <>
      {/* ≥ md: table */}
      <Card className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => {
                const active = sort && c.sortKey && sort.key === c.sortKey;
                const Icon = active ? (sort.order === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <TableHead
                    key={c.key}
                    aria-sort={active ? (sort.order === "asc" ? "ascending" : "descending") : undefined}
                    className={cn(
                      "h-11 px-4 text-caption font-medium text-muted-foreground",
                      alignClass[c.align ?? "left"],
                      c.width,
                    )}
                  >
                    {c.sortKey && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.sortKey as string)}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand",
                          active && "text-foreground",
                        )}
                      >
                        {c.header}
                        <Icon className={cn("h-3 w-3", !active && "opacity-40")} aria-hidden />
                      </button>
                    ) : (
                      c.header
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow
                key={rowKey(r)}
                {...rowProps(r)}
                className={cn(
                  clickable &&
                    "cursor-pointer hover:bg-accent/60 focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-[-2px]",
                )}
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
              {...rowProps(r)}
              className={cn(
                "p-4",
                clickable &&
                  "cursor-pointer active:bg-accent focus-visible:outline-2 focus-visible:outline-brand",
              )}
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
