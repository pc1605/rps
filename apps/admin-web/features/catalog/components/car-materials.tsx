"use client";

import { MATERIAL_UNIT_LABEL, PLAN_SOURCE_LABEL, type PlanSource } from "@rps/shared";
import { Layers, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { LotLink } from "@/components/rps/entity-link";
import { SectionTitle } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { type Draft, fromDrafts, LinesEditor, toDrafts } from "@/features/materials/components/lines-editor";
import { useOverrides, usePutOverrides, useResolve } from "@/features/materials/hooks";
import { cn } from "@/lib/utils";

const sourceTone = (s: PlanSource) =>
  s === "none"
    ? { text: "text-danger", border: "border-danger/30" }
    : s.startsWith("car")
      ? { text: "text-foreground", border: "border-foreground/30" }
      : { text: "text-muted-foreground", border: "border-border" };

function OverridesDialog({ carId, carName }: { carId: number; carName: string }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const { data } = useOverrides(carId);
  const put = usePutOverrides();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = fromDrafts(drafts, true);
    if (typeof lines === "string") return toast.error(lines);
    try {
      await put.mutateAsync({ carId, lines });
      toast.success(`Overrides saved for ${carName}`);
      setOpen(false);
    } catch (err) {
      toast.error("Couldn't save overrides", { description: (err as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDrafts(toDrafts(data?.lines ?? []));
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Edit overrides
          {data && data.lines.length > 0 && (
            <span className="tabular text-muted-foreground"> · {data.lines.length}</span>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Overrides for {carName}</DialogTitle>
            <DialogDescription>
              Replace the recipe for this car only. 0 = this car doesn't use the material. A width-specific
              line wins over "Any width".
            </DialogDescription>
          </DialogHeader>
          <LinesEditor drafts={drafts} setDrafts={setDrafts} allowZero />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={put.isPending}>
              Save overrides
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** What cutting N mats of this car would draw right now (the engine's own planner, read-only). */
export function CarMaterials({
  carId,
  carName,
  lineId,
}: {
  carId: number;
  carName: string;
  lineId?: number;
}) {
  const [qty, setQty] = useState("1");
  const n = Math.max(1, Math.min(999, Number(qty) || 1));
  const { data, isPending, isError } = useResolve(carId, n);

  return (
    <section className="space-y-3">
      <SectionTitle
        aside={
          <span className="flex items-center gap-2">
            {lineId && (
              <Link href={`/materials/recipes?line=${lineId}`} className="text-small hover:text-foreground">
                Recipe
              </Link>
            )}
            <OverridesDialog carId={carId} carName={carName} />
          </span>
        }
      >
        Materials
      </SectionTitle>
      <div className="flex items-center gap-2 text-small text-muted-foreground">
        <Label htmlFor="car-mats">If cut now:</Label>
        <Input
          id="car-mats"
          inputMode="numeric"
          value={qty}
          onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
          className="h-8 w-16 text-right"
        />
        <span>mat{n === 1 ? "" : "s"}</span>
      </div>
      {isError ? (
        <EmptyState title="Couldn't resolve materials" />
      ) : isPending || !data ? (
        <Skeleton className="h-32 w-full" />
      ) : data.lines.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No recipe for this car"
          body={data.notes[0] ?? "Add a recipe for its product line × consumption group."}
        />
      ) : (
        <Card className="divide-y p-0">
          {data.lines.map((l) => {
            const unit = MATERIAL_UNIT_LABEL[l.unit];
            return (
              <div key={l.material_type_id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <div className="min-w-40">
                  <div className="text-small font-medium">{l.type_name}</div>
                  <div className="text-caption text-muted-foreground">
                    {l.variant_name ? `for ${l.variant_name}` : "any width"}
                  </div>
                </div>
                <Chip tone={sourceTone(l.source)}>{PLAN_SOURCE_LABEL[l.source]}</Chip>
                <div className="tabular text-small">
                  {l.qty_per_mat != null ? (
                    <>
                      {l.qty_per_mat} {unit}/mat
                      {n > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          · need {l.need} {unit}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-danger">no quantity</span>
                  )}
                </div>
                <div className="ml-auto text-right text-caption text-muted-foreground">
                  {l.draws.length > 0 && (
                    <div>
                      from{" "}
                      {l.draws.map((d, i) => (
                        <span key={d.lot_id}>
                          {i > 0 && ", "}
                          <LotLink id={d.lot_id} code={d.lot_code} /> ({d.qty})
                        </span>
                      ))}
                    </div>
                  )}
                  <div className={cn(l.shortfall > 0 && "text-danger")}>
                    {l.available} {unit} available
                    {l.shortfall > 0 && ` · short ${l.shortfall} ${unit}`}
                  </div>
                </div>
              </div>
            );
          })}
        </Card>
      )}
    </section>
  );
}
