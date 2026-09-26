"use client";

import { Boxes } from "lucide-react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { cn } from "@/lib/utils";
import { useRollsStock } from "../hooks";
import type { Roll } from "../types";
import { AddRollDialog } from "./add-roll-dialog";
import { RollActions } from "./roll-actions";
import { StockBar } from "./stock-bar";

const statusTone = {
  finished: { text: "text-muted-foreground", border: "border-border" },
  low: { text: "text-danger", border: "border-danger/30", dot: "bg-danger" },
  active: {
    text: "text-working",
    border: "border-working/30",
    dot: "bg-working",
  },
};

const columns: Column<Roll>[] = [
  {
    key: "roll",
    header: "Roll",
    width: "w-[200px]",
    card: "title",
    cell: (r) => (
      <div className={cn(!r.is_active && "opacity-60")}>
        <div
          className={cn(
            "font-mono text-small font-semibold",
            !r.is_active && "text-muted-foreground line-through",
          )}
        >
          {r.roll_code}
        </div>
        <div className="text-caption text-muted-foreground">{r.color}</div>
      </div>
    ),
  },
  {
    key: "stock",
    header: "Stock",
    cell: (r) => (
      <div className={cn(!r.is_active && "opacity-60")}>
        <StockBar total={r.total_meters} remaining={r.remaining_meters} low={r.is_low} />
      </div>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "center",
    width: "w-[120px]",
    cell: (r) => {
      const key = !r.is_active ? "finished" : r.is_low ? "low" : "active";
      const label = { finished: "Finished", low: "Low", active: "Active" }[key];
      return (
        <Chip tone={statusTone[key]} dot={key !== "finished"}>
          {label}
        </Chip>
      );
    },
  },
  {
    key: "batches",
    header: "Batches",
    align: "center",
    width: "w-[90px]",
    cell: (r) => <span className="tabular text-muted-foreground">{r.batch_count}</span>,
  },
  {
    key: "actions",
    header: "Actions",
    align: "right",
    width: "w-[80px]",
    cell: (r) => <RollActions roll={r} />,
  },
];

export function RollList() {
  const { data: rolls, isPending, isError } = useRollsStock();

  if (isError)
    return <EmptyState title="Couldn't load rolls" body="Check the backend is running, then reload." />;

  return (
    <DataTable
      rows={rolls ?? []}
      columns={columns}
      rowKey={(r) => r.id}
      loading={isPending}
      empty={
        <EmptyState
          icon={Boxes}
          title="No rolls yet"
          body="Add each rexine roll as it arrives, so you always know what's on hand."
          action={<AddRollDialog />}
        />
      }
    />
  );
}
