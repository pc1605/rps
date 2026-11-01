"use client";

import type { WorkerDetail } from "@rps/shared";
import { ArrowRightLeft } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHandOver, useOpenStitching, useStitcherLoads } from "@/features/batches/hooks";
import { mats } from "@/lib/format";

const SAME = "same";

// Worker page (U3): hand over all of a stitcher's open stitching work — e.g. they're absent.
// One person takes everything by default; any batch can go to someone else.
export function HandOverDialog({ worker }: { worker: WorkerDetail }) {
  const isStitcher = worker.station === "stitcher";
  const { data: open } = useOpenStitching(worker.id, isStitcher);
  const work = (open ?? []).filter((o) => o.left_qty > 0);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!isStitcher || work.length === 0) return null;
  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline">
          <ArrowRightLeft className="h-4 w-4" aria-hidden /> Hand over open work
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        {dialogOpen && <HandOverForm worker={worker} onDone={() => setDialogOpen(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function HandOverForm({ worker, onDone }: { worker: WorkerDetail; onDone: () => void }) {
  const { data: open } = useOpenStitching(worker.id);
  const { data: loads } = useStitcherLoads();
  const handOver = useHandOver();
  const work = (open ?? []).filter((o) => o.left_qty > 0);
  const others = (loads ?? []).filter((l) => l.worker_id !== worker.id);

  const [picked, setTo] = useState("");
  // Default: the least busy other stitcher (loads are sorted that way).
  const to = picked || others[0]?.worker_id || "";
  const [perBatch, setPerBatch] = useState<Record<string, string>>({});
  const nameOf = (id: string) => others.find((o) => o.worker_id === id)?.name ?? "—";
  const target = (batchId: string) => {
    const v = perBatch[batchId];
    return v && v !== SAME ? v : to;
  };
  const quotaMats = work.reduce((s, o) => s + (o.target_qty != null ? o.left_qty : 0), 0);
  const ready = work.every((o) => target(o.batch_id));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await handOver.mutateAsync({
        from_worker_id: worker.id,
        moves: work.map((o) => ({ batch_id: o.batch_id, to_worker_id: target(o.batch_id) })),
      });
      const moved = res.reduce((s, r) => s + r.moved, 0);
      toast.success(
        `Handed over ${res.length} batch${res.length === 1 ? "" : "es"} from ${worker.name}` +
          (moved ? ` (${mats(moved)})` : ""),
      );
      onDone();
    } catch (err) {
      toast.error("Couldn't hand over", { description: (err as Error).message });
    }
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Hand over {worker.name}'s open work</DialogTitle>
        <DialogDescription>
          {worker.name} keeps credit for every mat they've stitched. Their remaining mats go to the person you
          pick.
        </DialogDescription>
      </DialogHeader>

      {others.length === 0 ? (
        <p className="text-small text-muted-foreground">There's no other active stitcher to hand over to.</p>
      ) : (
        <>
          <div className="space-y-2">
            <Label htmlFor="hand-over-to">Give everything to</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger id="hand-over-to" className="w-full">
                <SelectValue placeholder="Pick a stitcher" />
              </SelectTrigger>
              <SelectContent>
                {others.map((o) => (
                  <SelectItem key={o.worker_id} value={o.worker_id}>
                    {o.name} · {o.open_mats} open{o.on_floor ? " · on floor" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ul className="divide-y rounded-md border">
            {work.map((o) => (
              <li key={o.batch_id} className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-small font-medium">{o.car_name}</div>
                  <div className="text-caption text-muted-foreground">
                    <span className="font-mono">{o.batch_code}</span> ·{" "}
                    {o.target_qty != null ? (
                      <span className="tabular">
                        {o.left_qty} left of {o.target_qty}
                      </span>
                    ) : (
                      "shared pile"
                    )}
                  </div>
                </div>
                <Select
                  value={perBatch[o.batch_id] ?? SAME}
                  onValueChange={(v) => setPerBatch((p) => ({ ...p, [o.batch_id]: v }))}
                >
                  <SelectTrigger className="w-44" aria-label={`Who takes ${o.batch_code}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SAME}>{to ? nameOf(to) : "Same as above"}</SelectItem>
                    {others
                      .filter((x) => x.worker_id !== to)
                      .map((x) => (
                        <SelectItem key={x.worker_id} value={x.worker_id}>
                          {x.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </li>
            ))}
          </ul>
        </>
      )}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={!ready || handOver.isPending || others.length === 0}>
          {quotaMats ? `Hand over ${mats(quotaMats)}` : "Hand over"}
        </Button>
      </DialogFooter>
    </form>
  );
}
