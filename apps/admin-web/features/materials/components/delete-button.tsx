"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

/**
 * Delete for things nobody references. When `blocked` is set the dialog explains why instead of
 * offering the delete (the server enforces the same rule and answers 409).
 */
export function DeleteButton({
  name,
  blocked,
  onDelete,
}: {
  name: string;
  /** Why it can't be deleted, e.g. "Used by 3 cars". Undefined = deletable. */
  blocked?: string;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const confirm = async (e: React.MouseEvent) => {
    e.preventDefault();
    setPending(true);
    try {
      await onDelete();
      toast.success(`${name} deleted`);
      setOpen(false);
    } catch (err) {
      toast.error(`Couldn't delete ${name}`, { description: (err as Error).message });
    } finally {
      setPending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button type="button" variant="ghost" className="mr-auto text-danger hover:text-danger">
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{blocked ? `${name} can't be deleted` : `Delete ${name}?`}</AlertDialogTitle>
          <AlertDialogDescription>
            {blocked
              ? `${blocked}. Turn Active off instead — history stays intact and it disappears from pickers.`
              : "Nothing uses it yet, so it's removed for good. This can't be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{blocked ? "OK" : "Cancel"}</AlertDialogCancel>
          {!blocked && (
            <AlertDialogAction variant="destructive" onClick={confirm} disabled={pending}>
              Delete
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** Why a material type can't be deleted, or undefined when it can. */
export function typeBlocked(t: {
  deletable: boolean;
  has_history: boolean;
  recipe_lines: number;
  override_cars: number;
}): string | undefined {
  if (t.deletable) return undefined;
  const parts: string[] = [];
  if (t.has_history) parts.push("it has lots or ledger history");
  if (t.recipe_lines) parts.push(`it's in ${plural(t.recipe_lines, "recipe line")}`);
  if (t.override_cars) parts.push(`${plural(t.override_cars, "car")} override it`);
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Why a consumption group can't be deleted, or undefined when it can. */
export function groupBlocked(g: {
  deletable: boolean;
  car_count: number;
  recipe_lines: number;
  default_for_size?: string;
}): string | undefined {
  if (g.deletable) return undefined;
  const parts: string[] = [];
  if (g.car_count) parts.push(`${plural(g.car_count, "car")} use it`);
  if (g.default_for_size) parts.push(`it's the default for ${g.default_for_size} cars`);
  if (g.recipe_lines) parts.push(`its recipes have ${plural(g.recipe_lines, "line")}`);
  const s = parts.join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
