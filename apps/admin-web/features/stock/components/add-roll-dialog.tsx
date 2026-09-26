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
import { useCreateRoll } from "../hooks";

export function AddRollDialog() {
  const [open, setOpen] = useState(false);
  const [rollCode, setRollCode] = useState("");
  const [color, setColor] = useState("");
  const [meters, setMeters] = useState("");
  const createRoll = useCreateRoll();

  const total = Number.parseFloat(meters);
  const canSubmit =
    rollCode.trim().length > 0 && color.trim().length > 0 && total > 0 && !createRoll.isPending;

  const reset = () => {
    setRollCode("");
    setColor("");
    setMeters("");
  };

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canSubmit) return;
    try {
      const roll = await createRoll.mutateAsync({
        roll_code: rollCode.trim().toUpperCase(),
        color: color.trim(),
        total_meters: total,
      });
      toast.success(`Roll ${roll.roll_code} added`, {
        description: `${roll.total_meters} m of ${roll.color}`,
      });
      reset();
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't add roll", { description: (err as Error).message });
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
          <Plus className="h-4 w-4" aria-hidden /> Add roll
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add rexine roll</DialogTitle>
            <DialogDescription>Record a new roll arriving into stock.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="roll-code">Roll code</Label>
              <Input
                id="roll-code"
                value={rollCode}
                onChange={(e) => setRollCode(e.target.value)}
                placeholder="R-005"
                autoComplete="off"
                className="font-mono uppercase"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll-color">Colour</Label>
              <Input
                id="roll-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Jet Black"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="roll-meters">Total metres</Label>
              <Input
                id="roll-meters"
                type="number"
                inputMode="decimal"
                min={0.5}
                step="0.5"
                value={meters}
                onChange={(e) => setMeters(e.target.value)}
                placeholder="50"
                className="tabular"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {createRoll.isPending ? "Adding…" : "Add roll"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
