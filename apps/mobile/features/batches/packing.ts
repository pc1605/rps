import type { Batch } from "./types";

/**
 * What a packer still has to do on a batch, from the queue numbers.
 * A mat sent back for rework stays in the batch until it is fixed (then it must be packed) or the
 * owner writes it off — so the batch stays in the packer's queue with nothing to pack for now.
 */
export function packingRework(batch: Batch) {
  const inRework = batch.rework_open ?? 0;
  const left = Math.max(0, batch.units_total - batch.units_packed - batch.units_written_off - inRework);
  return { inRework, left, waiting: inRework > 0 && left === 0 };
}

/** Packer's queue order: batches that only wait for rework go last; the rest keep the server's order. */
export function packerQueue(batches: Batch[]): Batch[] {
  const waiting = (b: Batch) => packingRework(b).waiting;
  return [...batches.filter((b) => !waiting(b)), ...batches.filter(waiting)];
}
