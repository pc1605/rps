# Work Model — who may do what, and how work is recorded

**Read this before touching `StartPhase`, `ScanUnit`, `SetAssignments`, or `ListByPhase`.**

## 1. Three phases, three interaction styles
| Phase | Who | Claim style | How work is recorded | Parallelism |
|---|---|---|---|---|
| Cutting | cutters | **Exclusive** — one cutter per batch | Manual: Start, then Complete with a typed count | Across batches (3 stations, one batch each). Huge order → admin makes 2 batches. |
| Stitching | **assigned** stitchers | **Join** — many per batch | **Scan-per-mat**: stitcher sews the taffeta label in, scans it → `stitched_by/at` | Within batch, bounded by per-head quotas |
| Packing | packers | Join — many per batch | Scan-per-mat → `packed_by/at`, status `packed` | Within batch (quotas optional) |

Cutting can't scan: no mats exist yet and labels aren't on anything. Stitching can: the stitcher attaches the label.
Packing scans: verification of the finished physical mat.

## 2. Assignment (`batch_assignments`)
- Rows `(batch_id, phase, worker_id, target_qty?)`, set by admin via `PUT /batches/:id/assignments` (full replace per phase).
- **"Assigned = private."** If a phase has any assignment rows, only those workers see the batch in their queue and only
  they can Join (`ErrNotAssigned` 403). No rows → open queue for that station.
- **Stitching requires assignment** by construction: cutting-complete parks the batch as `awaiting_assignment`, which
  no worker queue returns. Assigning ≥1 stitcher flips it to `pending`.
- Cutting/packing are open today; assigning someone makes them private too (same rule, no special case).
- A stitcher's queue shows **only their own** batches — never "assigned to someone else" cards (owner: no cherry-picking).

## 3. Quotas (`target_qty`)
- Optional per assignee. If any assignee on a phase has one, **all must**, and they **sum to `batches.quantity`**.
- Enforced at scan: `ScanUnit` counts units already attributed to the worker in that phase; `>= target_qty` → `ErrQuotaReached`
  (409 `quota_reached`, "your share of this batch is complete (8/8)"). Mobile shows a blue "Your share is complete ✓" flash.
- Reassignment = edit numbers. `SetAssignments` enforces: target ≥ already-done; a worker with scans can't be removed
  (reduce their target instead); empty list on stitching parks the batch again.
- A quota caps a **count**, it does not pre-assign specific units. Any 8 mats count for Surya's 8; labels are fungible until attached.

## 4. Join / idempotency
- Stitching/packing Join when already joined → no-op 200.
- `ScanUnit` is idempotent: already-stitched (or already-packed) mat → `already_done: true` with current progress, no writes.
- Scans must belong to the batch the scanner was opened for — enforced **client-side** via unit-code prefix (the server has
  no batch context on a scan). See `05-mobile/screens-and-flows.md`.

## 5. Phase completion
When a scan makes `done_count == total_units`:
1. All open logs for that phase close: `completed_at = now()`, `quantity_completed = COUNT(units attributed to that worker)`.
2. `nextPhase`: stitching → packing/pending; packing → completed/completed; `version++`.
3. Response carries `phase_completed` (stitching) or `batch_completed` (packing).

## 6. The queue payload (`GET /worker/batches`)
Per batch beyond display fields: `units_total`, `units_packed`, `units_stitched`, `active_workers` ("Surya, Mahesh" — open logs now),
`joined_by_me`, `assigned_workers`, `assigned_to_me`, `my_target_qty` (null = uncapped), `my_done_qty`. Sort: assigned-to-me first, then oldest.

## 7. What the owner rejected (don't re-propose)
- Open self-service stitching queue → cherry-picking of small mats.
- Soft targets / permission-only assignment → they want strict per-head quotas.
- Unit-level pre-assignment ("Surya gets 001–008") → forces sorting the label strip by person; rejected for count quotas.
