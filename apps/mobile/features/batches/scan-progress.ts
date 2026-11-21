/** The scanner's progress pill: the batch's count and, with a share, the worker's own count and target. */
export interface ScanProgress {
  done: number;
  total: number;
  mine: number;
  target: number | null;
}

/** What the queue (re-read on every live note) says about this batch for this worker. */
export interface QueueProgress {
  done: number;
  total: number;
  mine: number;
  target: number | null;
}

/**
 * Brings the pill up to date with the queue. Counts only go up: a re-read that started before my last
 * scan would show one less. That also corrects "mine" after a scan whose answer was lost (timeout, then
 * the re-scan says "already done"). The target is the queue's: the admin may change it (hand-over, edit).
 * Returns `p` itself when nothing changed, so React skips the re-render.
 */
export function syncWithQueue(p: ScanProgress, q: QueueProgress | undefined): ScanProgress {
  if (!q) return p; // the batch left the queue (finished, handed over): keep what the scans said
  const next: ScanProgress = {
    done: Math.max(p.done, q.done),
    total: q.total || p.total,
    mine: Math.max(p.mine, q.mine),
    target: q.target,
  };
  const same =
    next.done === p.done && next.total === p.total && next.mine === p.mine && next.target === p.target;
  return same ? p : next;
}

/**
 * A stitcher's scan of a mat that is not from the batch the scanner was opened for. `batchCode` is the
 * code fixed when the scanner opened — not the queue's, which drops the batch once it's finished or
 * handed over (the check would then let any mat through).
 */
export function isWrongBatch(unitCode: string, batchCode: string): boolean {
  return batchCode !== "" && !unitCode.startsWith(`${batchCode}-`);
}
