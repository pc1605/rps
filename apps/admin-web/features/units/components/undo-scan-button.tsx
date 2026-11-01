"use client";

import type { Unit } from "@rps/shared";
import { Undo2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUndoScan } from "../hooks";

/** Which scan an undo would reverse, or null when there's nothing the admin can undo (server has the last word). */
export function undoableScan(u: Unit): "stitch" | "pack" | null {
  if (u.status === "packed") return "pack";
  if (u.status === "pending" && u.stitched_at && !u.prestitched) return "stitch";
  return null;
}

/** "Undo last scan" with a required reason (owner/supervisor; the API refuses what can't be undone). */
export function UndoScanButton({ unit, compact = false }: { unit: Unit; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const undo = useUndoScan(unit.unit_code);
  const scan = undoableScan(unit);
  if (!scan) return null;
  const who = scan === "pack" ? unit.packed_by_name : unit.stitched_by_name;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    try {
      const res = await undo.mutateAsync(reason.trim());
      toast.success(`${res.scan === "pack" ? "Pack" : "Stitch"} scan undone`, {
        description: res.moved_back
          ? `${res.batch_code} is back in ${res.phase}.`
          : `${res.unit_code} needs to be scanned again.`,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't undo", { description: (err as Error).message });
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setReason("");
      }}
    >
      <AlertDialogTrigger asChild>
        <Button
          type="button"
          variant={compact ? "ghost" : "outline"}
          size={compact ? "sm" : "default"}
          className={compact ? "w-full justify-start text-muted-foreground" : undefined}
        >
          <Undo2 className="h-3.5 w-3.5" aria-hidden /> Undo last scan
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Undo the {scan === "pack" ? "pack" : "stitch"} scan of {unit.unit_code}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {who ? `${who}'s scan is removed` : "The scan is removed"} and the mat has to be{" "}
              {scan === "pack" ? "packed" : "stitched"} again. If that scan finished the{" "}
              {scan === "pack" ? "batch" : "stitching"}, the batch goes back — only while nothing has happened
              in the next stage.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor={`undo-reason-${unit.id}`}>Reason</Label>
            <Textarea
              id={`undo-reason-${unit.id}`}
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. scanned the wrong mat"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={undo.isPending}>
              Keep
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!reason.trim() || undo.isPending}>
              {undo.isPending ? "Undoing…" : "Undo scan"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
