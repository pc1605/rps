"use client";

import { Plus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBatch, useRolls } from "../hooks";
import { CarModelSelect } from "./car-model-select";

export function CreateBatchDialog() {
  const [open, setOpen] = useState(false);
  const [carModelId, setCarModelId] = useState<number | "">("");
  const [rollId, setRollId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: rolls } = useRolls();
  const createBatch = useCreateBatch();

  const qty = Number(quantity);
  const canSubmit = !!carModelId && Number.isInteger(qty) && qty >= 1 && !createBatch.isPending;

  const reset = () => {
    setCarModelId("");
    setRollId("");
    setQuantity("");
    setNotes("");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    try {
      const batch = await createBatch.mutateAsync({
        car_model_id: Number(carModelId),
        roll_id: rollId || undefined,
        quantity: qty,
        notes: notes.trim() || undefined,
      });
      toast.success(`Batch ${batch.batch_code} created`, {
        description: `${batch.units_total} mats waiting for cutting.`,
      });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't create batch", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" aria-hidden /> New batch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Create batch</DialogTitle>
            <DialogDescription>
              Units are created now; taffeta labels print when you assign stitchers.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="batch-item">Item</Label>
              <CarModelSelect id="batch-item" value={carModelId} onChange={setCarModelId} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-qty">Quantity</Label>
              <Input
                id="batch-qty"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-roll">
                Rexine roll <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Select value={rollId || "none"} onValueChange={(v) => setRollId(v === "none" ? "" : v)}>
                <SelectTrigger id="batch-roll" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Unassigned</SelectItem>
                  {rolls?.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      <span className="font-mono">{r.roll_code}</span> · {r.color} ·{" "}
                      <span className="tabular">{r.remaining_meters} m</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="batch-notes">
                Notes <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="batch-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special instruction…"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createBatch.isPending ? "Creating…" : "Create batch"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
