# The Critical Queries, Explained

## `ListByPhase(phase, workerID)` — the worker queue
27 SELECT columns ↔ 27 Scan targets, in groups: display · unit roll-ups (total, packed, stitched) · active workers
(`string_agg` of open logs) + `joined_by_me` · assigned names + `assigned_to_me` · `my_target_qty` + `my_done_qty`.

WHERE:
```sql
b.current_phase = $1
AND b.status IN ('pending','in_progress')                         -- parked (awaiting_assignment) never shows
AND ( NOT EXISTS (assignment rows for this batch+phase)           -- open queue
      OR EXISTS (assignment row for this batch+phase AND worker_id = $2) )   -- or I'm assigned
ORDER BY (I'm assigned) DESC, b.created_at ASC
```
Why subselects instead of `LEFT JOIN phase_logs`: multiple open logs per batch would duplicate rows.

## `ScanUnit(unitCode, workerID, station)` — order of checks (do not reorder)
1. Station → phase; cutter → `ErrWrongPhase`.
2. Lock the unit's batch (`FOR UPDATE OF b`), read unit status, `stitched_at`, batch phase/status.
3. **Idempotent early return**: stitching & (`stitched_at` set or packed/dispatched) → `already_done`; packing & packed/dispatched → `already_done`. Returns progress, commits, no writes. This runs *before* phase checks so re-scanning after the batch moved on is friendly.
4. Batch must be at my phase and `in_progress`.
5. I must have an open log (joined) → else `ErrNotStarted`.
6. **Quota gate**: my `target_qty` (nullable) vs COUNT(units attributed to me in this phase) → `ErrQuotaReached`.
7. Apply: stitching → `stitched_by/at`; packing → `status='packed', packed_by/at`.
8. Progress: `COUNT(*)`, `COUNT(*) FILTER (done expr)`.
9. If all done: close all open logs of this phase with per-worker counts (`UPDATE phase_logs … quantity_completed = (SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND <attr_col> = pl.worker_id)`), advance batch, set `phase_completed` / `batch_completed`.
10. Audit, commit.

Note: the server never knows *which batch the scanner was opened for*. Cross-batch protection is client-side (unit-code prefix). If a worker is joined on two batches at the same phase, a foreign scan would succeed against the other batch — the mobile guard prevents this.

## `SetAssignments(batchID, phase, entries)` — validation order
1. Lock batch, read `quantity`.
2. Quotas: all-or-none; sum == quantity.
3. Per-worker done counts (`stitched_by` / `packed_by`): no target below done; no removal of a worker with done > 0.
4. Replace rows (DELETE + INSERT … ON CONFLICT DO UPDATE target_qty).
5. Stitching gate: entries>0 → `awaiting_assignment → pending`; entries==0 → `pending → awaiting_assignment`.
6. Audit, commit.

## `StartPhase` — the assignment gate
After the phase-match check: `assigned = EXISTS(any row)`, `isMine = EXISTS(row for me)`; `assigned && !isMine → ErrNotAssigned`.
Cutting then requires `pending` (exclusive). Others accept pending/in_progress and no-op if already joined.
`UPDATE batches SET status='in_progress' … WHERE status='pending'` (harmless on repeat joins).

## `GetStats` — alignment matters
Six FILTER columns; Scan args are written one per line in the same order. A swapped pair compiles and silently shows wrong numbers (this happened once).
