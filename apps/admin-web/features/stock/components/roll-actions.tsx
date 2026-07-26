"use client";

import { useState } from "react";
import { toast } from "sonner";
import { MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useUpdateRoll } from "../hooks";
import type { Roll } from "../types";

export function RollActions({ roll }: { roll: Roll }) {
  const [editOpen, setEditOpen] = useState(false);
  const [remaining, setRemaining] = useState(String(roll.remaining_meters));
  const updateRoll = useUpdateRoll();

  const saveRemaining = async () => {
    const val = parseFloat(remaining);
    if (isNaN(val) || val < 0) return;
    try {
      await updateRoll.mutateAsync({
        id: roll.id,
        input: { remaining_meters: val },
      });
      toast.success(`${roll.roll_code} updated`);
      setEditOpen(false);
    } catch (e) {
      toast.error("Update failed", { description: (e as Error).message });
    }
  };

  const toggleActive = async () => {
    try {
      await updateRoll.mutateAsync({
        id: roll.id,
        input: { is_active: !roll.is_active },
      });
      toast.success(
        roll.is_active
          ? `${roll.roll_code} marked finished`
          : `${roll.roll_code} reactivated`,
      );
    } catch (e) {
      toast.error("Update failed", { description: (e as Error).message });
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setRemaining(String(roll.remaining_meters));
              setEditOpen(true);
            }}
          >
            Correct remaining meters
          </DropdownMenuItem>
          <DropdownMenuItem onClick={toggleActive}>
            {roll.is_active ? "Mark finished" : "Reactivate"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{roll.roll_code} — remaining meters</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <label className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              Remaining (of {roll.total_meters}m)
            </label>
            <Input
              type="number"
              min={0}
              max={roll.total_meters}
              step="0.5"
              value={remaining}
              onChange={(e) => setRemaining(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Manual correction until automatic consumption tracking lands.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveRemaining} disabled={updateRoll.isPending}>
              {updateRoll.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
