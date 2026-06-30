"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { CarModelSelect } from "./car-model-select";
import { useRolls, useCreateBatch } from "../hooks";

export function CreateBatchDialog() {
  const [open, setOpen] = useState(false);
  const [carModelId, setCarModelId] = useState<number | "">("");
  const [rollId, setRollId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");

  const { data: rolls } = useRolls();
  const createBatch = useCreateBatch();

  const reset = () => {
    setCarModelId("");
    setRollId("");
    setQuantity("");
    setNotes("");
  };

  const submit = async () => {
    if (!carModelId || !quantity || Number(quantity) < 1) return;
    try {
      const batch = await createBatch.mutateAsync({
        car_model_id: Number(carModelId),
        roll_id: rollId || undefined,
        quantity: Number(quantity),
        notes: notes || undefined,
      });
      toast.success(`Batch ${batch.batch_code} created`, {
        description: `${batch.units_total} units ready for cutting.`,
      });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error("Failed to create batch", {
        description: (e as Error).message,
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
          <Plus className="h-4 w-4" /> New Batch
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create batch</DialogTitle>
          <DialogDescription>
            Start a new production order. Units and labels generate
            automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Car model
            </label>
            <CarModelSelect value={carModelId} onChange={setCarModelId} />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Quantity
            </label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="10"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Rexine roll (optional)
            </label>
            <Select
              value={rollId || "none"}
              onValueChange={(v) => setRollId(v === "none" ? "" : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Unassigned</SelectItem>
                {rolls?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.roll_code} — {r.color} ({r.remaining_meters}m)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Notes (optional)
            </label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any special instruction…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={
              !carModelId ||
              !quantity ||
              Number(quantity) < 1 ||
              createBatch.isPending
            }
          >
            {createBatch.isPending ? "Creating…" : "Create batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
