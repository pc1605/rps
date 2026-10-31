"use client";

import { MATERIAL_UNIT_LABEL, PLAN_SOURCE_LABEL } from "@rps/shared";
import { Layers } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";
import { LotLink } from "@/components/rps/entity-link";
import { SectionTitle } from "@/components/rps/section";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useBatchMaterials } from "@/features/materials/hooks";
import { fmtStamp } from "@/lib/format";
import { cn } from "@/lib/utils";

/** "Materials used" — plan rows + what was drawn, per cutting completion (C1b engine). */
export function BatchMaterials({ batchId }: { batchId: string }) {
  const { data, isPending, isError } = useBatchMaterials(batchId);
  const completions = (data?.completions ?? []).filter((c) => c.plan.length > 0 || c.movements.length > 0);

  return (
    <section className="space-y-3">
      <SectionTitle>Materials used</SectionTitle>
      {isError ? (
        <EmptyState title="Couldn't load materials" />
      ) : isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : completions.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="Nothing recorded yet"
          body="Materials are recorded when cutting completes."
        />
      ) : (
        <div className="space-y-3">
          {completions.map((c) => (
            <Card key={c.phase_log_id ?? "unlinked"} className="p-0">
              <div className="border-b px-4 py-2.5 text-small text-muted-foreground">
                {c.phase_log_id ? (
                  <>
                    Cut <span className="tabular text-foreground">{c.mats}</span> mats
                    {c.worker_name && (
                      <>
                        {" "}
                        by <span className="text-foreground">{c.worker_name}</span>
                      </>
                    )}{" "}
                    · {fmtStamp(c.completed_at)}
                  </>
                ) : (
                  "Not linked to a cutting completion"
                )}
              </div>
              <ul className="divide-y">
                {c.plan.map((p) => {
                  const unit = MATERIAL_UNIT_LABEL[p.unit];
                  const moves = c.movements.filter((m) => m.material_type_id === p.material_type_id);
                  const short = moves.filter((m) => !m.lot_id).reduce((a, m) => a - m.qty, 0);
                  return (
                    <li key={p.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-2.5">
                      <div className="min-w-40 text-small">
                        {p.type_name}
                        {p.variant_name && <span className="text-muted-foreground"> · {p.variant_name}</span>}
                      </div>
                      <div className={cn("tabular text-small", p.source === "none" && "text-danger")}>
                        {p.planned_qty != null ? (
                          <>
                            {p.qty_per_mat} × {p.mats} = {p.planned_qty} {unit}
                          </>
                        ) : (
                          "no recipe quantity"
                        )}
                        <span className="ml-2 text-caption text-muted-foreground">
                          {PLAN_SOURCE_LABEL[p.source]}
                        </span>
                      </div>
                      <div className="ml-auto text-right text-caption text-muted-foreground">
                        {moves
                          .filter((m) => m.lot_id)
                          .map((m, i) => (
                            <span key={m.id}>
                              {i > 0 && ", "}
                              <LotLink id={m.lot_id} code={m.lot_code} /> {-m.qty} {unit}
                            </span>
                          ))}
                        {short > 0 && (
                          <span className="ml-2 text-danger">
                            short {Math.round(short * 1000) / 1000} {unit}
                          </span>
                        )}
                        {moves.length === 0 &&
                          p.source !== "none" &&
                          p.planned_qty === 0 &&
                          "not used by this car"}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
