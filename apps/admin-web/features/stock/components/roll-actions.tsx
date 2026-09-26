"use client";

import { MoreHorizontal } from "lucide-react";
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
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateRoll } from "../hooks";
import type { Roll } from "../types";

export function RollActions({ roll }: { roll: Roll }) {
  const [editOpen, setEditOpen] = useState(false);
  const [remaining, setRemaining] = useState(String(roll.remaining_meters));
  const updateRoll = useUpdateRoll();

  const fieldId = `roll-remaining-${roll.id}`;
  const val = Number.parseFloat(remaining);
  const invalid = Number.isNaN(val) || val < 0 || val > roll.total_meters;

  const saveRemaining = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (invalid) return;
    try {
      await updateRoll.mutateAsync({
        id: roll.id,
        input: { remaining_meters: val },
      });
      toast.success(`${roll.roll_code} set to ${val} m`);
      setEditOpen(false);
    } catch (err) {
      toast.error("Couldn't update roll", {
        description: (err as Error).message,
      });
    }
  };

  const toggleActive = async () => {
    try {
      await updateRoll.mutateAsync({
        id: roll.id,
        input: { is_active: !roll.is_active },
      });
      toast.success(roll.is_active ? `${roll.roll_code} marked finished` : `${roll.roll_code} reactivated`);
    } catch (err) {
      toast.error("Couldn't update roll", {
        description: (err as Error).message,
      });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Actions for ${roll.roll_code}`}>
            <MoreHorizontal className="h-4 w-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onSelect={() => {
              setRemaining(String(roll.remaining_meters));
              setEditOpen(true);
            }}
          >
            Correct remaining metres
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={toggleActive}>
            {roll.is_active ? "Mark finished" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <form onSubmit={saveRemaining} className="grid gap-4">
            <DialogHeader>
              <DialogTitle>
                <span className="font-mono">{roll.roll_code}</span> · remaining metres
              </DialogTitle>
              <DialogDescription>
                Manual correction until automatic consumption tracking lands.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2">
              <Label htmlFor={fieldId}>
                Remaining{" "}
                <span className="font-normal text-muted-foreground">(of {roll.total_meters} m)</span>
              </Label>
              <Input
                id={fieldId}
                type="number"
                inputMode="decimal"
                min={0}
                max={roll.total_meters}
                step="0.5"
                value={remaining}
                onChange={(e) => setRemaining(e.target.value)}
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${fieldId}-err` : undefined}
                className="tabular"
              />
              {invalid && remaining !== "" && (
                <p id={`${fieldId}-err`} className="text-caption text-danger">
                  Enter a value between 0 and {roll.total_meters}.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={invalid || updateRoll.isPending}>
                {updateRoll.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
