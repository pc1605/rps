"use client";

import { CANCEL_REASON_LABEL, type CancelOutcome, type CancelReason } from "@rps/shared";
import { Ban } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useCancelBatch, useCancelPreview } from "../hooks";
import type { BatchDetail } from "../types";

const REASONS = Object.keys(CANCEL_REASON_LABEL) as CancelReason[];
const mats = (n: number) => `${n} ${n === 1 ? "mat" : "mats"}`;

/** "4 → spare (2 stitched), 2 never cut → removed, 1 in rework → written off" as lines. */
export function cancelOutcomeLines(o: CancelOutcome): string[] {
  const lines: string[] = [];
  const spare = o.spare_stitched + o.spare_unstitched;
  if (spare > 0)
    lines.push(
      `${mats(spare)} → spare stock${o.spare_stitched > 0 ? ` (${o.spare_stitched} stitched)` : ""}`,
    );
  if (o.removed > 0) lines.push(`${o.removed} never cut → removed`);
  if (o.written_off > 0) lines.push(`${o.written_off} in rework → written off`);
  return lines;
}

/** True while cancelling is possible at all (the server still decides: no mat may be packed). */
export const canCancelBatch = (b: BatchDetail) =>
  b.status !== "cancelled" &&
  b.status !== "completed" &&
  b.current_phase !== "completed" &&
  b.units_packed === 0;

export function CancelBatchDialog({ batch }: { batch: BatchDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason | "">("");
  const [note, setNote] = useState("");
  const preview = useCancelPreview(batch.id, open);
  const cancel = useCancelBatch(batch.id);

  if (!canCancelBatch(batch)) return null;

  const blocked = preview.data?.blocked;
  const ok = reason !== "" && (reason !== "other" || note.trim() !== "") && !!preview.data && !blocked;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    try {
      const res = await cancel.mutateAsync({ reason, note: note.trim() || undefined });
      toast.success(`${batch.batch_code} cancelled`, {
        description: cancelOutcomeLines(res).join(" · ") || undefined,
      });
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't cancel", { description: (err as Error).message });
    }
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setReason("");
          setNote("");
        }
      }}
    >
      <AlertDialogTrigger asChild>
        <Button variant="outline" className="text-danger">
          <Ban className="h-4 w-4" aria-hidden /> Cancel batch
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <form onSubmit={submit} className="grid gap-4">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel {batch.batch_code}?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone. Materials already used stay used. Spare mats can be reused on a new batch
              of the same item.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border p-3">
            {preview.isPending ? (
              <Skeleton className="h-10 w-full" />
            ) : preview.error ? (
              <p className="text-small text-danger">Couldn't load what happens to the mats.</p>
            ) : blocked ? (
              <p className="text-small text-danger">{blocked}</p>
            ) : (
              <ul className="space-y-1 text-small">
                {(preview.data ? cancelOutcomeLines(preview.data) : []).map((l) => (
                  <li key={l} className="tabular">
                    {l}
                  </li>
                ))}
                {preview.data && cancelOutcomeLines(preview.data).length === 0 && (
                  <li className="text-muted-foreground">No mats are affected.</li>
                )}
              </ul>
            )}
            {batch.active_workers && !blocked && (
              <p className="mt-2 text-caption text-muted-foreground">
                {batch.active_workers} {batch.active_workers.includes(",") ? "are" : "is"} working on it now —
                mats not yet reported cut count as never cut.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as CancelReason)}>
              <SelectTrigger id="cancel-reason" className="w-full">
                <SelectValue placeholder="Why is it cancelled?" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {CANCEL_REASON_LABEL[r]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cancel-note">
              Note{" "}
              <span className="font-normal text-muted-foreground">
                {reason === "other" ? "(required)" : "(optional)"}
              </span>
            </Label>
            <Textarea id="cancel-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel type="button" disabled={cancel.isPending}>
              Keep batch
            </AlertDialogCancel>
            <Button type="submit" variant="destructive" disabled={!ok || cancel.isPending}>
              {cancel.isPending ? "Cancelling…" : "Cancel batch"}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
