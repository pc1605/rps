"use client";

import { Minus, RotateCcw, Scissors, Split } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useResolveShort } from "../hooks";
import type { BatchDetail } from "../types";

const REASONS = ["Material ran out", "Order changed", "Defective material", "Other"];

export function ShortCutPanel({ batch }: { batch: BatchDetail }) {
  const resolve = useResolveShort(batch.id);
  const [reason, setReason] = useState(REASONS[0]);
  const short = batch.quantity - batch.cut_qty;

  if (batch.status !== "awaiting_assignment" || short <= 0) return null;

  const run = async (action: "split" | "reduce" | "recut") => {
    try {
      const res = await resolve.mutateAsync({
        action,
        reason: action === "reduce" ? reason : undefined,
      });
      toast.success(
        action === "split"
          ? `Split — remainder batch ${res.remainder_batch_code} is in the cutting queue`
          : action === "reduce"
            ? `Reduced to ${batch.cut_qty} mats`
            : `Sent back to cutting for the remaining ${short}`,
      );
    } catch (e) {
      toast.error("Couldn't resolve", { description: (e as Error).message });
    }
  };

  return (
    <Card className="border-brand/40 bg-brand/5 p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Scissors className="h-4 w-4 text-brand" />
        <h2 className="text-h2">
          Short cut · {batch.cut_qty} of {batch.quantity}
        </h2>
      </div>
      <p className="text-small text-muted-foreground">
        The cutter reported {batch.cut_qty} mats cut. Decide what happens to the remaining {short} before
        assigning stitchers.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Button
          variant="outline"
          className="h-auto flex-col items-start gap-1 p-3 text-left"
          onClick={() => run("split")}
          disabled={resolve.isPending}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <Split className="h-4 w-4" /> Split
          </span>
          <span className="text-caption text-muted-foreground">
            Continue with {batch.cut_qty}; a new batch of {short} goes back to cutting.
          </span>
        </Button>
        <Button
          variant="outline"
          className="h-auto flex-col items-start gap-1 p-3 text-left"
          onClick={() => run("recut")}
          disabled={resolve.isPending}
        >
          <span className="inline-flex items-center gap-2 font-medium">
            <RotateCcw className="h-4 w-4" /> Re-cut
          </span>
          <span className="text-caption text-muted-foreground">
            Send this batch back to cutting for the remaining {short}.
          </span>
        </Button>
        <div className="flex flex-col gap-2">
          <Button
            variant="outline"
            className="h-auto flex-col items-start gap-1 p-3 text-left"
            onClick={() => run("reduce")}
            disabled={resolve.isPending}
          >
            <span className="inline-flex items-center gap-2 font-medium">
              <Minus className="h-4 w-4" /> Reduce
            </span>
            <span className="text-caption text-muted-foreground">
              Make this a {batch.cut_qty}-mat batch; drop the rest.
            </span>
          </Button>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger className="h-8 text-small">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}
