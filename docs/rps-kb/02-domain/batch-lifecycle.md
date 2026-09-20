# Batch Lifecycle (state machine)

```
admin creates
     │
cutting / pending ── cutter Start ──▶ cutting / in_progress
                                            │ cutter Complete (qty)
                                            ▼
                         stitching / awaiting_assignment   ← "Ready for stitching": admin only, workers see nothing
                                            │ admin SetAssignments(≥1 stitcher [, quotas]) → labels print
                                            ▼
                               stitching / pending ── assignee Join ──▶ stitching / in_progress
                                            │ last unit scanned (all units stitched_at set)
                                            ▼
                                 packing / pending ── packer Join ──▶ packing / in_progress
                                            │ last unit scanned (all units packed)
                                            ▼
                                 completed / completed
```

## Transition rules (where in code)
| Transition | Trigger | Code |
|---|---|---|
| cutting pending → in_progress | `POST /worker/batches/:id/start` by a cutter | `StartPhase` (exclusive via `idx_phase_logs_open_cutting`) |
| cutting → stitching/awaiting_assignment | `POST /worker/batches/:id/complete` by *the* cutter, `quantity_completed` | `CompletePhase` → `nextPhase(cutting) = (stitching, awaiting_assignment)` |
| awaiting_assignment → pending | `PUT /batches/:id/assignments` with ≥1 stitcher | `SetAssignments` |
| pending → awaiting_assignment | same endpoint, empty list, while still pending | `SetAssignments` |
| stitching pending → in_progress | Join by an assignee | `StartPhase` (per-worker index) |
| stitching → packing/pending | The scan that sets the last `stitched_at` | `ScanUnit` (closes all open stitching logs with per-worker counts) |
| packing → completed | The scan that packs the last unit | `ScanUnit` |

**Manual `complete` is cutting-only.** For stitching/packing it returns 400 "… completes automatically when all units are scanned".

## Visibility per status
- `awaiting_assignment`: admin only (Batches → Ready to stitch). Worker queues filter `status IN ('pending','in_progress')`.
- Stitching pending/in_progress: only assigned stitchers.
- Cutting / packing: open queues (unless an assignment exists for that phase — then assignees only).

## Timeline
`GET /batches/:id` → `timeline[]` = every `phase_logs` row with worker name, start/end, duration, quantity.
Multi-worker phases yield multiple rows (two stitching entries: 8 pcs and 2 pcs; a joiner with no scans shows 0 pcs).

## Rework (Slice B — designed, not built)
Unit-level `status='rework'`; batch stays at packing; mat routes back to its `stitched_by`; `rework_logs(unit_id, flagged_by,
reason, photo_path, flagged_at, fixed_by, fixed_at)`; `batches.rework_count++`. Design in `08-roadmap/remaining-slices.md`.
