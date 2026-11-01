"use client";

import type { BatchEditInput } from "@rps/shared";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useEditBatch } from "../hooks";
import type { BatchDetail } from "../types";
import { CarModelSelect } from "./car-model-select";
import { RollSelect } from "./roll-select";

/** True while the batch waits in the open cutting queue (nobody has claimed it). */
export const canEditBatch = (b: BatchDetail) => b.current_phase === "cutting" && b.status === "pending";

export function EditBatchDialog({ batch }: { batch: BatchDetail }) {
  const [open, setOpen] = useState(false);
  const [carModelId, setCarModelId] = useState<number | "">(batch.car_model_id);
  const [rollId, setRollId] = useState(batch.roll_id ?? "");
  const [quantity, setQuantity] = useState(String(batch.quantity));
  const [notes, setNotes] = useState(batch.notes ?? "");
  const edit = useEditBatch(batch.id);

  const reset = () => {
    setCarModelId(batch.car_model_id);
    setRollId(batch.roll_id ?? "");
    setQuantity(String(batch.quantity));
    setNotes(batch.notes ?? "");
  };

  if (!canEditBatch(batch)) return null;

  // Mats already cut (re-cut after a short cut, or reused spares) fix the car and the minimum quantity.
  const carLocked = batch.cut_qty > 0;
  const qty = Number(quantity);
  const qtyOk = Number.isInteger(qty) && qty >= 1 && qty > batch.cut_qty;
  const canSubmit = !!carModelId && qtyOk && !edit.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    const input: BatchEditInput = {};
    if (carModelId !== batch.car_model_id) input.car_model_id = Number(carModelId);
    if (qty !== batch.quantity) input.quantity = qty;
    if (rollId !== (batch.roll_id ?? "")) input.roll_id = rollId;
    if (notes.trim() !== (batch.notes ?? "")) input.notes = notes.trim();
    if (Object.keys(input).length === 0) {
      setOpen(false);
      return;
    }
    try {
      await edit.mutateAsync(input);
      toast.success(`${batch.batch_code} updated`);
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't save changes", { description: (err as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Pencil className="h-4 w-4" aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit {batch.batch_code}</DialogTitle>
            <DialogDescription>Possible until a cutter starts this batch.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-item">Item</Label>
              {carLocked ? (
                <p id="edit-item" className="text-small text-muted-foreground">
                  {batch.brand_name} {batch.model_name} — fixed, {batch.cut_qty} already cut
                </p>
              ) : (
                <CarModelSelect id="edit-item" value={carModelId} onChange={setCarModelId} />
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-qty">Quantity</Label>
              <Input
                id="edit-qty"
                type="number"
                inputMode="numeric"
                min={batch.cut_qty + 1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              {carLocked && (
                <p className="text-caption text-muted-foreground">More than {batch.cut_qty} (already cut).</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-roll">Roll</Label>
              <RollSelect id="edit-roll" carModelId={carModelId} value={rollId} onChange={setRollId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea id="edit-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {edit.isPending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
