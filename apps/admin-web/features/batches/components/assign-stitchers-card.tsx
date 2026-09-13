"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Printer, UserCheck, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useWorkers } from "@/features/workers/hooks";
import { useSetAssignments } from "../hooks";
import { generateLabelPdf } from "../label-pdf";
import type { BatchDetail } from "../types";

type Draft = Record<string, number | "">; // worker_id → target (checked = present in map)

export function AssignStitchersCard({ batch }: { batch: BatchDetail }) {
  if (batch.current_phase !== "stitching") return null;
  const savedKey = batch.assignments
    .filter((a) => a.phase === "stitching")
    .map((a) => `${a.worker_id}:${a.target_qty ?? ""}`)
    .sort()
    .join(",");
  return <Inner key={`${batch.id}:${savedKey}`} batch={batch} />;
}

function Inner({ batch }: { batch: BatchDetail }) {
  const { data: workers } = useWorkers();
  const setAssignments = useSetAssignments(batch.id);
  const stitchers = (workers ?? []).filter(
    (w) => w.station === "stitcher" && w.is_active,
  );
  const saved = batch.assignments.filter((a) => a.phase === "stitching");
  const doneBy = Object.fromEntries(
    saved.map((a) => [a.worker_id, a.done_qty]),
  );

  const [draft, setDraft] = useState<Draft>(() =>
    Object.fromEntries(saved.map((a) => [a.worker_id, a.target_qty ?? ""])),
  );

  const ids = Object.keys(draft);
  const total = ids.reduce((s, id) => s + (Number(draft[id]) || 0), 0);
  const balanced = ids.length > 0 && total === batch.quantity;
  const isAwaiting = batch.status === "awaiting_assignment";

  const toggle = (id: string) =>
    setDraft((d) => {
      if (id in d) {
        if ((doneBy[id] ?? 0) > 0) {
          toast.error(
            `Can't remove — already stitched ${doneBy[id]}. Lower their target instead.`,
          );
          return d;
        }
        const { [id]: _, ...rest } = d;
        return rest;
      }
      return { ...d, [id]: "" };
    });

  const setQty = (id: string, v: string) =>
    setDraft((d) => ({
      ...d,
      [id]: v === "" ? "" : Math.max(0, parseInt(v, 10) || 0),
    }));

  // Even split of the batch across checked stitchers (remainder to the first)
  const autoSplit = () => {
    if (!ids.length) return;
    const base = Math.floor(batch.quantity / ids.length);
    const rem = batch.quantity - base * ids.length;
    setDraft(
      Object.fromEntries(ids.map((id, i) => [id, base + (i < rem ? 1 : 0)])),
    );
  };

  const save = async (print: boolean) => {
    try {
      await setAssignments.mutateAsync({
        phase: "stitching",
        assignments: ids.map((id) => ({
          worker_id: id,
          target_qty: Number(draft[id]),
        })),
      });
      toast.success(
        ids.length
          ? `Assigned ${batch.quantity} mats across ${ids.length}`
          : "Assignment cleared — batch parked",
      );
      if (print && ids.length) await generateLabelPdf(batch, "taffeta");
    } catch (e) {
      toast.error("Couldn't save assignment", {
        description: (e as Error).message,
      });
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Stitching assignment
        </h2>
        {isAwaiting && (
          <span className="font-mono text-[10px] uppercase text-amber-600 dark:text-amber-400 animate-pulse">
            Ready for stitching — assign to release
          </span>
        )}
      </div>

      <div className="space-y-2">
        {stitchers.map((w) => {
          const checked = w.id in draft;
          const done = doneBy[w.id] ?? 0;
          return (
            <div
              key={w.id}
              className={cn(
                "flex items-center gap-3 rounded-md border p-2.5",
                checked && "border-primary/40 bg-primary/5",
              )}
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(w.id)}
              />
              <span className="flex-1 text-sm">{w.name}</span>
              {checked && (
                <>
                  {done > 0 && (
                    <span className="font-mono text-xs text-muted-foreground">
                      {done} done ·
                    </span>
                  )}
                  <Input
                    type="number"
                    min={done || 1}
                    value={draft[w.id]}
                    onChange={(e) => setQty(w.id, e.target.value)}
                    className="h-8 w-20 text-right font-mono tabular-nums"
                    placeholder="mats"
                  />
                </>
              )}
            </div>
          );
        })}
        {!stitchers.length && (
          <p className="text-sm text-muted-foreground">No active stitchers.</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div
          className={cn(
            "font-mono text-xs tabular-nums",
            balanced
              ? "text-emerald-600 dark:text-emerald-400"
              : "text-amber-600 dark:text-amber-400",
          )}
        >
          {ids.length
            ? `${total} / ${batch.quantity} mats assigned ${balanced ? "✓" : `· ${batch.quantity - total} left`}`
            : "Nobody assigned"}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={autoSplit}
          disabled={!ids.length}
        >
          <Scale className="h-3.5 w-3.5" /> Split evenly
        </Button>
      </div>

      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => save(false)}
          disabled={setAssignments.isPending || (ids.length > 0 && !balanced)}
        >
          <UserCheck className="h-4 w-4" /> Save
        </Button>
        <Button
          size="sm"
          onClick={() => save(true)}
          disabled={setAssignments.isPending || !balanced}
        >
          <Printer className="h-4 w-4" /> Assign & print labels
        </Button>
      </div>
    </Card>
  );
}
