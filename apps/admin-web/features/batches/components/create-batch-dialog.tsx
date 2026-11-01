"use client";

import { Layers, Plus } from "lucide-react";
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
import { MATERIAL_UNIT_LABEL } from "@rps/shared";
import { useResolve } from "@/features/materials/hooks";
import { useSpares } from "@/features/stock/hooks";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useCreateBatch } from "../hooks";
import { CarModelSelect } from "./car-model-select";
import { RollSelect } from "./roll-select";

export function CreateBatchDialog() {
  const [open, setOpen] = useState(false);
  const [carModelId, setCarModelId] = useState<number | "">("");
  const [rollId, setRollId] = useState<string>("");
  const [quantity, setQuantity] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [useSpare, setUseSpare] = useState(false);

  const createBatch = useCreateBatch();

  const qty = Number(quantity);
  // Spares of exactly this car item (D36): stitched first, never more than the batch needs.
  const { data: spareRows } = useSpares(carModelId || undefined, !!carModelId);
  const spare = spareRows?.[0];
  const spareTotal = spare ? spare.stitched + spare.unstitched : 0;
  const qtyOk = Number.isInteger(qty) && qty >= 1;
  const useSt = useSpare && spare && qtyOk ? Math.min(spare.stitched, qty) : 0;
  const useUn = useSpare && spare && qtyOk ? Math.min(spare.unstitched, qty - useSt) : 0;
  const toCut = qtyOk ? qty - useSt - useUn : 0;
  const canSubmit = !!carModelId && Number.isInteger(qty) && qty >= 1 && !createBatch.isPending;

  const reset = () => {
    setCarModelId("");
    setRollId("");
    setQuantity("");
    setNotes("");
    setUseSpare(false);
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
        spares_stitched: useSt || undefined,
        spares_unstitched: useUn || undefined,
      });
      toast.success(`Batch ${batch.batch_code} created`, {
        description:
          useSt + useUn === 0
            ? `${batch.units_total} mats waiting for cutting.`
            : toCut > 0
              ? `${useSt + useUn} spare mats reused · ${toCut} to cut.`
              : `All ${batch.units_total} mats from spares — no cutting needed.`,
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

            {spare && spareTotal > 0 && (
              <div className="flex items-start justify-between gap-3 rounded-md border border-brand/40 bg-brand/5 p-3">
                <div className="min-w-0 text-small">
                  <Label htmlFor="batch-use-spares" className="inline-flex items-center gap-2">
                    <Layers className="h-4 w-4 text-brand" aria-hidden />
                    {spareTotal} spare {spareTotal === 1 ? "mat" : "mats"}
                    {spare.stitched > 0 && ` (${spare.stitched} stitched)`} — use them
                  </Label>
                  <p className="mt-1 text-caption text-muted-foreground">
                    {useSpare && qtyOk
                      ? toCut > 0
                        ? `Uses ${useSt + useUn}; the cutter cuts ${toCut}.`
                        : useSt === qty
                          ? "All already stitched — goes straight to packing."
                          : "No cutting needed — goes straight to Ready to stitch."
                      : "From cancelled batches of this item. They join the batch already cut."}
                  </p>
                </div>
                <Switch id="batch-use-spares" checked={useSpare} onCheckedChange={setUseSpare} />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="batch-roll">
                Roll{" "}
                <span className="font-normal text-muted-foreground">
                  (optional — otherwise oldest stock first)
                </span>
              </Label>
              <RollSelect id="batch-roll" carModelId={carModelId} value={rollId} onChange={setRollId} />
            </div>

            {carModelId && toCut >= 1 && (
              <MaterialsPreview carId={Number(carModelId)} qty={toCut} lotId={rollId || undefined} />
            )}

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

/** What cutting this batch would draw right now (engine dry run) — shortfalls show before creating. */
function MaterialsPreview({ carId, qty, lotId }: { carId: number; qty: number; lotId?: string }) {
  const { data } = useResolve(carId, qty, lotId);
  if (!data) return null;
  if (data.lines.length === 0)
    return (
      <p className="text-caption text-muted-foreground">
        No recipe for this car yet — materials won't be recorded.
      </p>
    );
  return (
    <div className="rounded-md border p-3">
      <div className="mb-1.5 text-caption text-muted-foreground">Materials at cutting (if cut now)</div>
      <ul className="space-y-1">
        {data.lines
          .filter((l) => l.need !== 0)
          .map((l) => (
            <li key={l.material_type_id} className="flex justify-between gap-3 text-small">
              <span>
                {l.type_name}
                {l.variant_name && <span className="text-muted-foreground"> · {l.variant_name}</span>}
              </span>
              <span className={cn("tabular", (l.shortfall > 0 || l.source === "none") && "text-danger")}>
                {l.need != null ? `${l.need} ${MATERIAL_UNIT_LABEL[l.unit]}` : "no recipe qty"}
                {l.shortfall > 0 && ` · short ${l.shortfall}`}
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
