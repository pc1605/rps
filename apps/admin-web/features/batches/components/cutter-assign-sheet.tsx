"use client";

import type { CutterLoad } from "@rps/shared";
import { Scissors } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/rps/empty-state";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { mats } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBatch, useCutterLoads, useSetAssignments } from "../hooks";
import type { BatchDetail } from "../types";
import { waitingFor } from "./assign-sheet";

// Cutter assign panel (D48): one cutter per batch, picked by the admin — no cutter picks work on their own.
// Used from the Needs a cutter list and the batch page.

export function CutterAssignSheet({
  batchId,
  readySince,
  open,
  onOpenChange,
}: {
  batchId: string | null;
  /** From the list row (the detail endpoint doesn't carry it). */
  readySince?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="gap-0 data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        {batchId ? (
          <Body batchId={batchId} readySince={readySince} onDone={() => onOpenChange(false)} />
        ) : (
          <SheetHeader>
            <SheetTitle>Assign a cutter</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ batchId, readySince, onDone }: { batchId: string; readySince?: string; onDone: () => void }) {
  const { data: batch, isPending, error } = useBatch(batchId);
  const loads = useCutterLoads();

  if (isPending || loads.isPending) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Assign a cutter</SheetTitle>
          <SheetDescription>Loading…</SheetDescription>
        </SheetHeader>
        <div className="space-y-2 px-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </>
    );
  }
  if (error || loads.error || !batch) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Assign a cutter</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <EmptyState title="Couldn't load this batch" body={(error ?? loads.error)?.message} />
        </div>
      </>
    );
  }

  const awaiting = batch.status === "awaiting_assignment";
  const waiting = awaiting ? waitingFor(readySince) : null;
  const toCut = batch.quantity - batch.cut_qty;
  const header = (
    <SheetHeader className="border-b pr-12">
      <SheetTitle className="text-h2">
        {awaiting ? "Assign a cutter" : "Cutter"} · <span className="font-mono">{batch.batch_code}</span>
      </SheetTitle>
      <SheetDescription>
        {batch.brand_name} {batch.model_name} · <span className="tabular">{toCut}</span> to cut
        {waiting && <> · waiting {waiting}</>}
      </SheetDescription>
    </SheetHeader>
  );

  let blocked: string | null = null;
  if (batch.current_phase !== "cutting" || batch.status === "cancelled")
    blocked = "This batch is not in cutting — nothing to assign.";
  else if (batch.status === "in_progress")
    blocked = `${batch.active_workers ?? "A cutter"} is cutting it now. Release the claim in the timeline below to change the cutter.`;
  if (blocked) {
    return (
      <>
        {header}
        <div className="p-4">
          <EmptyState title="Can't change the cutter" body={blocked} />
        </div>
      </>
    );
  }

  const saved = batch.assignments.find((a) => a.phase === "cutting")?.worker_id ?? null;
  return (
    <>
      {header}
      <CutterForm
        key={`${batch.id}:${saved ?? ""}`}
        batch={batch}
        saved={saved}
        loads={loads.data}
        onDone={onDone}
      />
    </>
  );
}

function CutterForm({
  batch,
  saved,
  loads,
  onDone,
}: {
  batch: BatchDetail;
  saved: string | null;
  loads: CutterLoad[];
  onDone: () => void;
}) {
  const setAssignments = useSetAssignments(batch.id);
  const [picked, setPicked] = useState<string | null>(saved);
  const name = (id: string | null) => loads.find((l) => l.worker_id === id)?.name ?? "the cutter";
  const busy = setAssignments.isPending;

  const save = async (workerId: string | null) => {
    try {
      await setAssignments.mutateAsync({
        phase: "cutting",
        assignments: workerId ? [{ worker_id: workerId }] : [],
      });
      toast.success(
        workerId
          ? `${batch.batch_code} assigned to ${name(workerId)}`
          : `${batch.batch_code} is back in Needs a cutter`,
      );
      onDone();
    } catch (err) {
      toast.error("Couldn't save the cutter", { description: (err as Error).message });
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (picked) save(picked);
  };

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <p className="text-caption text-muted-foreground">
          One cutter cuts the whole batch. Only they see it on their phone. Least busy first.
        </p>
        {loads.length === 0 ? (
          <EmptyState
            icon={Scissors}
            title="No active cutters"
            body="Add or reactivate a cutter on the Workers page."
          />
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">Cutter</legend>
            {loads.map((l) => {
              const on = picked === l.worker_id;
              return (
                <label
                  key={l.worker_id}
                  htmlFor={`cutter-${l.worker_id}`}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3",
                    on && "border-phase-cutting/40 bg-phase-cutting/5",
                  )}
                >
                  <input
                    id={`cutter-${l.worker_id}`}
                    type="radio"
                    name="cutter"
                    value={l.worker_id}
                    checked={on}
                    disabled={busy}
                    onChange={() => setPicked(l.worker_id)}
                    className="h-4 w-4 accent-phase-cutting"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-medium">
                      {l.name}
                      {l.worker_id === saved && (
                        <span className="ml-2 text-caption text-muted-foreground">assigned now</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-2 text-caption text-muted-foreground">
                      {l.on_floor ? (
                        <span className="text-working">● Cutting now</span>
                      ) : l.cut_today === 0 ? (
                        <span>Not seen today</span>
                      ) : (
                        <span>Not on a batch</span>
                      )}
                      <span className="tabular">
                        {l.open_batches} {l.open_batches === 1 ? "batch" : "batches"} · {mats(l.open_mats)}{" "}
                        open · {l.cut_today} cut today
                      </span>
                    </div>
                  </div>
                </label>
              );
            })}
          </fieldset>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
        {saved ? (
          <Button type="button" variant="outline" disabled={busy} onClick={() => save(null)}>
            Remove cutter
          </Button>
        ) : (
          <span />
        )}
        <Button type="submit" size="lg" disabled={busy || !picked || picked === saved}>
          {picked ? `Assign to ${name(picked)}` : "Pick a cutter"}
        </Button>
      </div>
    </form>
  );
}
