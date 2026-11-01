"use client";

import type { StitcherLoad } from "@rps/shared";
import { ArrowRightLeft, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/rps/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtDuration, mats } from "@/lib/format";
import { cn } from "@/lib/utils";
import { fill, rebalance, sumOf, type Targets } from "../assign-split";
import { useBatch, useHandOver, useSetAssignments, useStitcherLoads } from "../hooks";
import { generateLabelPdf } from "../label-pdf";
import type { BatchDetail } from "../types";

// Stitching assign panel (U3): one side panel for the Ready list and the batch page.

const PRINT_KEY = "rps.assign.printLabels";
function readPrintPref() {
  try {
    return localStorage.getItem(PRINT_KEY) !== "0";
  } catch {
    return true;
  }
}
function writePrintPref(v: boolean) {
  try {
    localStorage.setItem(PRINT_KEY, v ? "1" : "0");
  } catch {
    // storage blocked: the default (print) applies next time
  }
}

/** "3h 5m" since an ISO time, or null. */
export function waitingFor(iso?: string | null) {
  if (!iso) return null;
  return fmtDuration(Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000)));
}

export function AssignSheet({
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
            <SheetTitle>Assign stitchers</SheetTitle>
          </SheetHeader>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Body({ batchId, readySince, onDone }: { batchId: string; readySince?: string; onDone: () => void }) {
  const { data: batch, isPending, error } = useBatch(batchId);
  const loads = useStitcherLoads();

  if (isPending || loads.isPending) {
    return (
      <>
        <SheetHeader>
          <SheetTitle>Assign stitchers</SheetTitle>
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
          <SheetTitle>Assign stitchers</SheetTitle>
        </SheetHeader>
        <div className="px-4">
          <EmptyState title="Couldn't load this batch" body={(error ?? loads.error)?.message} />
        </div>
      </>
    );
  }

  const awaiting = batch.status === "awaiting_assignment";
  const waiting = awaiting ? waitingFor(readySince) : null;
  const header = (
    <SheetHeader className="border-b pr-12">
      <SheetTitle className="text-h2">
        {awaiting ? "Assign" : "Stitching"} <span className="font-mono">{batch.batch_code}</span>
      </SheetTitle>
      <SheetDescription>
        {batch.brand_name} {batch.model_name} · <span className="tabular">{batch.quantity}</span> mats
        {waiting && <> · waiting {waiting}</>}
      </SheetDescription>
    </SheetHeader>
  );

  let blocked: string | null = null;
  if (batch.current_phase !== "stitching") blocked = "This batch has left stitching — nothing to assign.";
  else if (awaiting && batch.cut_qty < batch.quantity)
    blocked = `Only ${batch.cut_qty} of ${batch.quantity} mats are cut. Resolve the short cut on the batch page first.`;
  if (blocked) {
    return (
      <>
        {header}
        <div className="p-4">
          <EmptyState title="Can't assign yet" body={blocked} />
        </div>
      </>
    );
  }

  const saved = batch.assignments.filter((a) => a.phase === "stitching");
  const savedKey = saved
    .map((a) => `${a.worker_id}:${a.target_qty ?? ""}:${a.done_qty}`)
    .sort()
    .join(",");
  return (
    <>
      {header}
      <AssignForm
        key={`${batch.id}:${batch.status}:${savedKey}`}
        batch={batch}
        loads={loads.data}
        onDone={onDone}
      />
    </>
  );
}

type Row = StitcherLoad & { inactive?: boolean };

function AssignForm({
  batch,
  loads,
  onDone,
}: {
  batch: BatchDetail;
  loads: StitcherLoad[];
  onDone: () => void;
}) {
  const setAssignments = useSetAssignments(batch.id);
  const handOver = useHandOver();
  const qty = batch.quantity;
  const awaiting = batch.status === "awaiting_assignment";
  const saved = batch.assignments.filter((a) => a.phase === "stitching");
  const done: Record<string, number> = Object.fromEntries(saved.map((a) => [a.worker_id, a.done_qty]));

  // Load order (least busy first); assignees who are no longer active stitchers stay visible at the end.
  const rows: Row[] = useMemo(() => {
    const known = new Set(loads.map((l) => l.worker_id));
    const extra: Row[] = saved
      .filter((a) => !known.has(a.worker_id))
      .map((a) => ({
        worker_id: a.worker_id,
        name: a.worker_name,
        open_mats: 0,
        open_batches: 0,
        on_floor: false,
        last_scan_at: null,
        mats_today: 0,
        inactive: true,
      }));
    return [...loads, ...extra];
  }, [loads, saved]);
  const order = rows.map((r) => r.worker_id);

  const [mode, setMode] = useState<"quota" | "shared">(() =>
    saved.length > 0 && saved.every((a) => a.target_qty == null) ? "shared" : "quota",
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(saved.map((a) => a.worker_id)));
  const [targets, setTargets] = useState<Targets>(() =>
    Object.fromEntries(
      saved.filter((a) => a.target_qty != null).map((a) => [a.worker_id, a.target_qty as number]),
    ),
  );
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [print, setPrint] = useState(readPrintPref);

  const ids = order.filter((id) => selected.has(id));
  // Shared → quota with no saved numbers yet: start from an even split.
  const quotaTargets =
    mode === "quota" && ids.some((id) => targets[id] == null) ? (fill(qty, ids, done) ?? {}) : targets;
  const total = sumOf(ids, quotaTargets);
  const balanced = mode === "shared" || total === qty;

  const savedSig = saved
    .map((a) => `${a.worker_id}:${a.target_qty ?? ""}`)
    .sort()
    .join(",");
  const draftSig = ids
    .map((id) => `${id}:${mode === "quota" ? quotaTargets[id] : ""}`)
    .sort()
    .join(",");
  const dirty = savedSig !== draftSig;

  const toggle = (id: string) => {
    const on = selected.has(id);
    if (on && (done[id] ?? 0) > 0) {
      toast.error(`Already stitched ${done[id]} — use “Move remaining” instead of removing them.`);
      return;
    }
    const next = new Set(selected);
    if (on) next.delete(id);
    else next.add(id);
    const nextIds = order.filter((x) => next.has(x));
    const split = fill(qty, nextIds, done);
    if (!split) {
      toast.error(`Only ${qty} mats — can't give everyone at least one.`);
      return;
    }
    setSelected(next);
    setTargets(split);
    setPinned(new Set());
  };

  const setQty = (id: string, raw: string) => {
    const v = Number.parseInt(raw, 10);
    const r = rebalance(qty, ids, quotaTargets, done, pinned, id, Number.isNaN(v) ? 0 : v);
    setTargets(r.targets);
    setPinned(r.pinned);
  };

  const splitEvenly = () => {
    setTargets(fill(qty, ids, done) ?? {});
    setPinned(new Set());
  };

  const moveRemaining = async (from: Row, to: Row) => {
    try {
      const [r] = await handOver.mutateAsync({
        from_worker_id: from.worker_id,
        moves: [{ batch_id: batch.id, to_worker_id: to.worker_id }],
      });
      toast.success(`Moved ${mats(r?.moved ?? 0)} from ${from.name} to ${to.name}`);
    } catch (e) {
      toast.error("Couldn't move the mats", { description: (e as Error).message });
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await setAssignments.mutateAsync({
        phase: "stitching",
        assignments: ids.map((id) => ({
          worker_id: id,
          target_qty: mode === "quota" ? quotaTargets[id] : undefined,
        })),
      });
      const names = ids.map((id) => rows.find((r) => r.worker_id === id)?.name).filter(Boolean);
      toast.success(
        ids.length
          ? `${batch.batch_code} assigned to ${names.join(", ")}`
          : `${batch.batch_code} is back in Ready to stitch`,
      );
      onDone();
      if (awaiting && ids.length && print) {
        try {
          await generateLabelPdf(batch, "taffeta");
        } catch (err) {
          toast.error("Assigned, but the labels didn't print", { description: (err as Error).message });
        }
      }
    } catch (err) {
      toast.error("Couldn't save the assignment", { description: (err as Error).message });
    }
  };

  const busy = setAssignments.isPending || handOver.isPending;
  let label = `Assign ${mats(qty)}`;
  if (!awaiting) label = ids.length ? "Save changes" : "Unassign — back to Ready";
  const canSubmit = !busy && balanced && (awaiting ? ids.length > 0 : dirty);

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <fieldset className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
          <legend className="sr-only">How mats are shared</legend>
          {(
            [
              ["quota", "Fixed share each"],
              ["shared", "Shared pile"],
            ] as const
          ).map(([m, text]) => (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={mode === m ? "outline" : "ghost"}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn(mode === m && "bg-background")}
            >
              {text}
            </Button>
          ))}
        </fieldset>
        <p className="text-caption text-muted-foreground">
          {mode === "quota"
            ? "Each person stitches their own number of mats. Tick one person to give them the whole batch."
            : "No numbers: anyone ticked can stitch any mat until the batch is done."}
        </p>

        {rows.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No active stitchers"
            body="Add or reactivate a stitcher on the Workers page."
          />
        ) : (
          <ul className="space-y-2">
            {rows.map((r) => {
              const id = r.worker_id;
              const on = selected.has(id);
              const d = done[id] ?? 0;
              const s = saved.find((a) => a.worker_id === id);
              const left = s?.target_qty != null ? s.target_qty - d : 0;
              const canMove = !awaiting && !dirty && left > 0;
              const others = rows.filter((o) => o.worker_id !== id && !o.inactive);
              return (
                <li
                  key={id}
                  className={cn(
                    "flex items-center gap-3 rounded-md border p-3",
                    on && "border-phase-stitching/40 bg-phase-stitching/5",
                  )}
                >
                  <Checkbox
                    id={`assign-${id}`}
                    checked={on}
                    disabled={busy || (r.inactive && !on)}
                    onCheckedChange={() => toggle(id)}
                  />
                  <div className="min-w-0 flex-1">
                    <Label htmlFor={`assign-${id}`} className="text-body font-medium">
                      {r.name}
                    </Label>
                    <div className="flex flex-wrap gap-x-2 text-caption text-muted-foreground">
                      {r.inactive ? (
                        <span>Inactive</span>
                      ) : r.on_floor ? (
                        <span className="text-working">● On floor</span>
                      ) : r.mats_today === 0 ? (
                        <span>Not seen today</span>
                      ) : (
                        <span>Not on a batch</span>
                      )}
                      <span className="tabular">
                        {r.open_mats} open · {r.mats_today} today
                      </span>
                    </div>
                  </div>
                  {on && mode === "quota" && (
                    <div className="flex items-center gap-2">
                      {d > 0 && (
                        <span className="text-caption tabular text-muted-foreground">{d} done /</span>
                      )}
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={Math.max(d, 1)}
                        max={qty}
                        aria-label={`Mats for ${r.name}`}
                        value={quotaTargets[id] ?? ""}
                        onChange={(e) => setQty(id, e.target.value)}
                        disabled={busy || ids.length === 1}
                        className="h-9 w-16 text-right tabular"
                      />
                    </div>
                  )}
                  {canMove && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Move ${r.name}'s remaining mats`}
                          disabled={busy}
                        >
                          <ArrowRightLeft />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>
                          Move {left} remaining from {r.name} to…
                        </DropdownMenuLabel>
                        {others.map((o) => (
                          <DropdownMenuItem key={o.worker_id} onSelect={() => moveRemaining(r, o)}>
                            <span className="flex-1">{o.name}</span>
                            <span className="text-caption tabular text-muted-foreground">
                              {o.open_mats} open
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {mode === "quota" && ids.length > 0 && (
          <div className="space-y-2">
            {ids.length > 1 && (
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {ids.map((id, i) => (
                  <div
                    key={id}
                    style={{ flexGrow: quotaTargets[id] ?? 0 }}
                    className={cn("h-full", i % 2 ? "bg-phase-stitching/50" : "bg-phase-stitching")}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center justify-between gap-2 text-small">
              <span className="text-muted-foreground">
                {ids.length === 1
                  ? `${rows.find((r) => r.worker_id === ids[0])?.name} gets all ${mats(qty)}`
                  : ids
                      .map((id) => `${rows.find((r) => r.worker_id === id)?.name} ${quotaTargets[id]}`)
                      .join(" · ")}
              </span>
              <span className={cn("tabular", balanced ? "text-working" : "text-danger")}>
                {total} / {qty} {balanced ? "✓" : `· ${qty - total} left`}
              </span>
            </div>
            {ids.length > 1 && (
              <Button type="button" variant="ghost" size="sm" onClick={splitEvenly} disabled={busy}>
                Split evenly again
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t p-4">
        {awaiting ? (
          <div className="flex items-center gap-2">
            <Checkbox
              id="assign-print"
              checked={print}
              onCheckedChange={(v) => {
                setPrint(v === true);
                writePrintPref(v === true);
              }}
            />
            <Label htmlFor="assign-print" className="text-small">
              Print labels after
            </Label>
          </div>
        ) : (
          <span className="text-caption text-muted-foreground">
            {dirty ? "Unsaved changes" : "Use ⇄ on a row to move someone's remaining mats"}
          </span>
        )}
        <Button type="submit" size="lg" disabled={!canSubmit}>
          {label}
        </Button>
      </div>
    </form>
  );
}
