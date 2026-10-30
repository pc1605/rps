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

## 8. Rework & Defects (Slice B)

### Unit Lifecycle & States
In addition to `pending` and `packed`, `batch_units` supports:
- `rework`: The mat was flagged by a packer during packing inspection and paused for defect correction.
- `defective`: The mat was permanently written off (by admin decision `write_off` or after recut creation).
- **Completion condition**: A batch at packing advances to `completed` **only when every unit is either `packed` or `defective`** (`status IN ('packed', 'defective', 'dispatched')`). Units in `rework` or `pending` block batch completion.

### Inspection & Flagging Flow
1. **Peek before action**: A packer scans a mat QR to inspect its state via `GET /worker/units/:code/peek`. Peek returns unit metadata, `can_pack: true/false`, and `can_rework: true/false`.
2. **Flagging**: If a mat has flaws, the packer submits `POST /worker/units/:code/rework` with multipart form data containing:
   - `reasons`: array of strings (`stitching_fault`, `stain`, `cutting_fault`, `material_defect`, `other`).
   - `note`: optional descriptive context.
   - `photos`: 1–3 photos captured via camera.
   - Flags unit as `status = 'rework'` and increments `batches.rework_count`.

### Routing Rules & Escalation
- **Round 1 Routing**:
  - `stitching_fault`, `stain`, `other` → automatically routes to the original stitcher who stitched the mat (`bu.stitched_by`), with `route = 'stitcher'`.
  - `cutting_fault` or `material_defect` → routes to `route = 'admin'` for management oversight.
- **Round 2+ Escalation**: Any unit returned to rework for a second round (`round >= 2`) automatically routes to `route = 'admin'`, preventing infinite stitcher retry loops.

### Stitcher Fix Scan
- Stitchers view their assigned rework mats via `GET /worker/rework`.
- When the stitcher repairs the defect, they scan the unit barcode (`POST /worker/units/scan`).
- The server verifies `bu.stitched_by == worker_id` (403 `not_your_rework` if scanned by another worker).
- Successful scan:
  - Closes the rework log with `fixed_by = worker_id`, `fixed_at = NOW()`.
  - Resets unit status from `'rework'` back to `'pending'`.
  - Returns `{ rework_fixed: true }` in the scan response.
  - Unit is now ready to be scanned and packed by the packer.

### Admin Decisions
For items routed to admin (`route = 'admin'`), the admin chooses via `POST /rework/:id/decide`:
- `to_stitcher`: Overrides decision and routes mat back to the original stitcher to repair.
- `recut`: Creates a new 1-mat batch for the same car model with linked audit history, marks original unit `defective`.
- `write_off`: Confirms irreparable damage and marks unit `defective`.

### Scan Enforcements in Rework
- Packer scanning a unit in `rework` → 409 `in_rework` ("This mat is waiting for rework").
- Packer scanning a `defective` unit → 409 `written_off` ("unit was written off as defective").
- Stitcher scanning a unit awaiting admin decision → 409 `rework_pending_decision`.
- Re-flagging an already-reworked unit while a round is open → 409 `already_in_rework`.

