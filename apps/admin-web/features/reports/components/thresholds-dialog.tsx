"use client";

import { REPORT_STAGE_LABEL, type ReportStage, type StuckHours } from "@rps/shared";
import { SlidersHorizontal } from "lucide-react";
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
import { usePutStuckHours, useSettings } from "../hooks";

const STAGES: ReportStage[] = ["cutting", "awaiting_assignment", "stitching", "packing"];

/** Edit app_settings.stuck_hours — idle hours before a batch counts as stuck, per stage. */
export function ThresholdsDialog() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Record<ReportStage, string>>({
    cutting: "",
    awaiting_assignment: "",
    stitching: "",
    packing: "",
  });
  const { data } = useSettings();
  const put = usePutStuckHours();
  const parsed = Object.fromEntries(STAGES.map((s) => [s, Number(draft[s])])) as unknown as StuckHours;
  const ok = STAGES.every((s) => /^\d+$/.test(draft[s]) && parsed[s] >= 1 && parsed[s] <= 720);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    try {
      await put.mutateAsync(parsed);
      toast.success("Stuck thresholds saved");
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't save thresholds", { description: (err as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && data)
          setDraft(
            Object.fromEntries(STAGES.map((s) => [s, String(data.stuck_hours[s])])) as Record<
              ReportStage,
              string
            >,
          );
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm" disabled={!data}>
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Thresholds
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Stuck thresholds</DialogTitle>
            <DialogDescription>
              A batch is stuck when nothing happens to it — no scan, claim or step — for this many hours in
              its current stage.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {STAGES.map((s) => (
              <div key={s} className="space-y-2">
                <Label htmlFor={`stuck-${s}`}>{REPORT_STAGE_LABEL[s]}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`stuck-${s}`}
                    inputMode="numeric"
                    value={draft[s]}
                    onChange={(e) => setDraft({ ...draft, [s]: e.target.value.replace(/\D/g, "") })}
                    className="w-20 text-right"
                  />
                  <span className="text-small text-muted-foreground">h</span>
                </div>
              </div>
            ))}
          </div>
          {!ok && <p className="text-caption text-danger">Each threshold: 1 to 720 hours.</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok || put.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
