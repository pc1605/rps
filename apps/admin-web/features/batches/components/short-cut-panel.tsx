"use client";

import { SHORT_REASON_LABEL, type ShortAction, type ShortReason } from "@rps/shared";
import { Minus, RotateCcw, Scissors, Split } from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useResolveShort } from "../hooks";
import type { BatchDetail } from "../types";

const REASONS = Object.keys(SHORT_REASON_LABEL) as ShortReason[];

export function ShortCutPanel({ batch }: { batch: BatchDetail }) {
  const resolve = useResolveShort(batch.id);
  const [action, setAction] = useState<ShortAction | null>(null);
  const [reason, setReason] = useState<ShortReason | "">("");
  const [note, setNote] = useState("");
  const short = batch.quantity - batch.cut_qty;

  if (batch.status !== "awaiting_assignment" || short <= 0) return null;

  const copy: Record<ShortAction, { icon: typeof Split; title: string; body: string; confirm: string }> = {
    split: {
      icon: Split,
      title: "Split",
      body: `Continue with ${batch.cut_qty}; a new batch of ${short} goes back to cutting.`,
      confirm: `Split off ${short}`,
    },
    recut: {
      icon: RotateCcw,
      title: "Re-cut",
      body: `Send this batch back to cutting for the remaining ${short}.`,
      confirm: "Send back to cutting",
    },
    reduce: {
      icon: Minus,
      title: "Reduce",
      body: `Make this a ${batch.cut_qty}-mat batch; the other ${short} are removed.`,
      confirm: `Reduce to ${batch.cut_qty}`,
    },
  };

  const open = (a: ShortAction) => {
    setAction(a);
    setReason("");
    setNote("");
  };
  const ok = reason !== "" && (reason !== "other" || note.trim() !== "");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!action || reason === "" || !ok) return;
    try {
      const res = await resolve.mutateAsync({ action, reason, note: note.trim() || undefined });
      toast.success(
        action === "split"
          ? `Split — remainder batch ${res.remainder_batch_code} is in the cutting queue`
          : action === "reduce"
            ? `Reduced to ${batch.cut_qty} mats`
            : `Sent back to cutting for the remaining ${short}`,
      );
      setAction(null);
    } catch (err) {
      toast.error("Couldn't resolve", { description: (err as Error).message });
    }
  };

  return (
    <Card className="space-y-4 border-brand/40 bg-brand/5 p-5">
      <div className="flex items-center gap-2">
        <Scissors className="h-4 w-4 text-brand" aria-hidden />
        <h2 className="text-h2">
          Short cut · {batch.cut_qty} of {batch.quantity}
        </h2>
      </div>
      <p className="text-small text-muted-foreground">
        The cutter reported {batch.cut_qty} mats cut. Decide what happens to the remaining {short} before
        assigning stitchers.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["split", "recut", "reduce"] as const).map((a) => {
          const { icon: Icon, title, body } = copy[a];
          return (
            <Button
              key={a}
              type="button"
              variant="outline"
              className="h-auto flex-col items-start gap-1 whitespace-normal p-3 text-left"
              onClick={() => open(a)}
              disabled={resolve.isPending}
            >
              <span className="inline-flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4" aria-hidden /> {title}
              </span>
              <span className="text-caption text-muted-foreground">{body}</span>
            </Button>
          );
        })}
      </div>

      <AlertDialog open={action !== null} onOpenChange={(o) => !o && setAction(null)}>
        <AlertDialogContent>
          {action && (
            <form onSubmit={submit} className="grid gap-4">
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {copy[action].title} {batch.batch_code}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {copy[action].body}
                  {action === "reduce" && " This can't be undone."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="space-y-2">
                <Label htmlFor="short-reason">Reason</Label>
                <Select value={reason} onValueChange={(v) => setReason(v as ShortReason)}>
                  <SelectTrigger id="short-reason" className="w-full">
                    <SelectValue placeholder="Why was it short?" />
                  </SelectTrigger>
                  <SelectContent>
                    {REASONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {SHORT_REASON_LABEL[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="short-note">
                  Note{" "}
                  <span className="font-normal text-muted-foreground">
                    {reason === "other" ? "(required)" : "(optional)"}
                  </span>
                </Label>
                <Textarea id="short-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel type="button" disabled={resolve.isPending}>
                  Cancel
                </AlertDialogCancel>
                <Button
                  type="submit"
                  variant={action === "reduce" ? "destructive" : "default"}
                  disabled={!ok || resolve.isPending}
                >
                  {copy[action].confirm}
                </Button>
              </AlertDialogFooter>
            </form>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
