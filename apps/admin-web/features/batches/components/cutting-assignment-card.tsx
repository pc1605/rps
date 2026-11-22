"use client";

import { Scissors, UserPlus } from "lucide-react";
import { useState } from "react";
import { WorkerLink } from "@/components/rps/entity-link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { BatchDetail } from "../types";
import { CutterAssignSheet } from "./cutter-assign-sheet";

// Batch page summary of the cutter (D48); changes happen in the CutterAssignSheet.
export function CuttingAssignmentCard({ batch }: { batch: BatchDetail }) {
  const [open, setOpen] = useState(false);
  if (batch.current_phase !== "cutting" || batch.status === "cancelled") return null;

  const cutter = batch.assignments.find((a) => a.phase === "cutting");
  const awaiting = batch.status === "awaiting_assignment";
  const cutting = batch.status === "in_progress";

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="text-h2">Cutter</h2>
        <p className="text-small text-muted-foreground">
          {awaiting || !cutter ? (
            "Nobody is assigned yet. Assign a cutter to send this batch to their phone."
          ) : (
            <>
              <WorkerLink
                id={cutter.worker_id}
                name={cutter.worker_name}
                className="font-medium text-foreground"
              />
              {cutting ? " is cutting it now." : " has it in their queue and hasn't started yet."}
            </>
          )}
        </p>
      </div>
      {awaiting ? (
        <Button type="button" size="lg" onClick={() => setOpen(true)}>
          <UserPlus aria-hidden /> Assign a cutter
        </Button>
      ) : (
        !cutting && (
          <Button type="button" variant="outline" onClick={() => setOpen(true)}>
            <Scissors aria-hidden /> Change cutter
          </Button>
        )
      )}
      <CutterAssignSheet batchId={batch.id} open={open} onOpenChange={setOpen} />
    </Card>
  );
}
