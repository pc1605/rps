"use client";

import { UserPlus, Users } from "lucide-react";
import { useState } from "react";
import { WorkerLink } from "@/components/rps/entity-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BatchDetail } from "../types";
import { AssignSheet } from "./assign-sheet";

// Batch page summary of the stitching assignment (U3); all changes happen in the AssignSheet.
export function StitchingAssignmentCard({ batch }: { batch: BatchDetail }) {
  const [open, setOpen] = useState(false);
  // A cancelled batch keeps its phase (U3) but has nothing left to assign.
  if (batch.current_phase !== "stitching" || batch.status === "cancelled") return null;
  // The short-cut panel above owns this state.
  if (batch.status === "awaiting_assignment" && batch.cut_qty < batch.quantity) return null;

  const saved = batch.assignments.filter((a) => a.phase === "stitching");
  const awaiting = batch.status === "awaiting_assignment";
  const shared = saved.length > 0 && saved.every((a) => a.target_qty == null);

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-h2">Stitching assignment</h2>
          <p className="text-small text-muted-foreground">
            {awaiting
              ? "Nobody is assigned yet. Assign stitchers to release this batch to the floor."
              : shared
                ? "Shared pile: anyone assigned can stitch any mat."
                : "Fixed share each."}
          </p>
        </div>
        {awaiting ? (
          <Button type="button" size="lg" onClick={() => setOpen(true)}>
            <UserPlus aria-hidden /> Assign stitchers
          </Button>
        ) : (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <Users aria-hidden /> Change or move work
          </Button>
        )}
      </div>

      {saved.length > 0 && (
        <ul className="divide-y rounded-md border">
          {saved.map((a) => {
            const target = a.target_qty;
            const pct = target ? Math.min(100, Math.round((a.done_qty / target) * 100)) : 0;
            return (
              <li key={a.worker_id} className="flex items-center gap-3 px-3 py-2.5">
                <WorkerLink id={a.worker_id} name={a.worker_name} className="flex-1 text-small font-medium" />
                {target != null && (
                  <div
                    className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block"
                    aria-hidden
                  >
                    <div className="h-full bg-phase-stitching" style={{ width: `${pct}%` }} />
                  </div>
                )}
                <span className="w-24 text-right text-small tabular text-muted-foreground">
                  {target != null ? `${a.done_qty} / ${target}` : `${a.done_qty} stitched`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <AssignSheet batchId={batch.id} open={open} onOpenChange={setOpen} />
    </Card>
  );
}
