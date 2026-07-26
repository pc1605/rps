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
import { Plus } from "lucide-react";
import { useCreateRoll } from "../hooks";

export function AddRollDialog() {
  const [open, setOpen] = useState(false);
  const [rollCode, setRollCode] = useState("");
  const [color, setColor] = useState("");
  const [meters, setMeters] = useState("");
  const createRoll = useCreateRoll();

  const valid = rollCode.trim() && color.trim() && parseFloat(meters) > 0;

  const reset = () => {
    setRollCode("");
    setColor("");
    setMeters("");
  };

  const submit = async () => {
    if (!valid) return;
    try {
      const roll = await createRoll.mutateAsync({
        roll_code: rollCode.trim(),
        color: color.trim(),
        total_meters: parseFloat(meters),
      });
      toast.success(`Roll ${roll.roll_code} added`, {
        description: `${roll.total_meters}m of ${roll.color}`,
      });
      reset();
      setOpen(false);
    } catch (e) {
      toast.error("Failed to add roll", { description: (e as Error).message });
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
          <Plus className="h-4 w-4" /> Add Roll
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add rexine roll</DialogTitle>
          <DialogDescription>
            Record a new roll arrival into stock.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Roll code
            </label>
            <Input
              value={rollCode}
              onChange={(e) => setRollCode(e.target.value)}
              placeholder="R-005"
            />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Color
            </label>
            <Input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Jet Black"
            />
          </div>
          <div className="space-y-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Total meters
            </label>
            <Input
              type="number"
              min={1}
              step="0.5"
              value={meters}
              onChange={(e) => setMeters(e.target.value)}
              placeholder="50"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!valid || createRoll.isPending}>
            {createRoll.isPending ? "Adding…" : "Add roll"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
