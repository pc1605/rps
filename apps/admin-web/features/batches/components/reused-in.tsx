import type { Batch } from "@rps/shared";
import { Fragment } from "react";
import { BatchLink } from "@/components/rps/entity-link";

/**
 * A cancelled batch whose spare mats moved on to new batches (P1):
 * "All 5 mats reused in B-2026-050" · "3 mats reused in B-2026-050 (2), B-2026-051 (1)".
 */
export function ReusedInLine({ batch, className }: { batch: Batch; className?: string }) {
  const to = batch.reused_in ?? [];
  if (to.length === 0) return null;
  const total = to.reduce((n, r) => n + r.count, 0);
  const what = batch.units_total === 0 ? `All ${total} mats` : `${total} ${total === 1 ? "mat" : "mats"}`;
  return (
    <span className={className}>
      {what} reused in{" "}
      {to.map((r, i) => (
        <Fragment key={r.batch_id}>
          {i > 0 && ", "}
          <BatchLink id={r.batch_id} code={r.batch_code} />
          {to.length > 1 && <span className="tabular"> ({r.count})</span>}
        </Fragment>
      ))}
    </span>
  );
}
