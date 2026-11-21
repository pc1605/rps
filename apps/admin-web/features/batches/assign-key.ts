import type { AssignmentEntry } from "@rps/shared";

/**
 * React key for the assign form: it starts over (from the saved assignments) only when a different
 * batch is open or the saved stitching assignment itself changed — who is on it and their targets
 * (after a save here, or one from another browser). Not on scans (`done_qty`) or the first join
 * (status): the batch is live and re-read on every scan, and the admin's unsaved numbers must stay.
 */
export function assignFormKey(batchId: string, assignments: AssignmentEntry[]): string {
  const saved = assignments
    .filter((a) => a.phase === "stitching")
    .map((a) => `${a.worker_id}:${a.target_qty ?? ""}`)
    .sort()
    .join(",");
  return `${batchId}:${saved}`;
}
