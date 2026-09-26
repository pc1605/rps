"use client";

import { Users } from "lucide-react";
import { Chip } from "@/components/rps/chip";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { stationTone } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { useWorkers } from "../hooks";
import type { Worker } from "../types";
import { CreateWorkerDialog } from "./create-worker-dialog";
import { EnrollmentQrDialog } from "./enrollment-qr-dialog";

const stationLabel: Record<string, string> = {
  cutter: "Cutter",
  stitcher: "Stitcher",
  packer: "Packer",
};

const columns: Column<Worker>[] = [
  {
    key: "name",
    header: "Name",
    card: "title",
    cell: (w) => (
      <span className={cn("font-medium", !w.is_active && "text-muted-foreground line-through")}>
        {w.name}
      </span>
    ),
  },
  {
    key: "station",
    header: "Station",
    width: "w-[140px]",
    cell: (w) => (
      <Chip tone={stationTone[w.station as keyof typeof stationTone]} dot>
        {stationLabel[w.station] ?? w.station}
      </Chip>
    ),
  },
  {
    key: "status",
    header: "Status",
    align: "center",
    width: "w-[110px]",
    cell: (w) => (
      <Chip
        tone={
          w.is_active
            ? {
                text: "text-working",
                border: "border-working/30",
                dot: "bg-working",
              }
            : { text: "text-muted-foreground", border: "border-border" }
        }
        dot={w.is_active}
      >
        {w.is_active ? "Active" : "Inactive"}
      </Chip>
    ),
  },
  {
    key: "last_login",
    header: "Last login",
    align: "right",
    width: "w-[140px]",
    cell: (w) =>
      w.last_login_at ? (
        <time dateTime={w.last_login_at} className="tabular text-caption text-muted-foreground">
          {new Date(w.last_login_at).toLocaleDateString()}
        </time>
      ) : (
        <span className="text-caption text-muted-foreground">Not enrolled yet</span>
      ),
  },
  {
    key: "enroll",
    header: "Enroll",
    align: "right",
    width: "w-[70px]",
    cell: (w) => <EnrollmentQrDialog workerId={w.id} workerName={w.name} />,
  },
];

export function WorkerList() {
  const { data: workers, isPending, isError } = useWorkers();

  if (isError)
    return <EmptyState title="Couldn't load workers" body="Check the backend is running, then reload." />;

  return (
    <DataTable
      rows={workers ?? []}
      columns={columns}
      rowKey={(w) => w.id}
      loading={isPending}
      empty={
        <EmptyState
          icon={Users}
          title="No workers yet"
          body="Add a worker, then scan their enrollment QR with their phone."
          action={<CreateWorkerDialog />}
        />
      }
    />
  );
}
