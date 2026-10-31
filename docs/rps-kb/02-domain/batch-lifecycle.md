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
| cutting → stitching/awaiting_assignment | `POST /worker/batches/:id/complete` by *the* cutter, `quantity_completed` | `CompletePhase` → records `cut_qty`. If `cut_qty < quantity`, flags short-cut. |
| short-cut resolution | `POST /batches/:id/resolve-short` (`split` / `reduce` / `recut`) | `ResolveShort` (admin decides: splits remainder, cancels un-cut units, or recuts) |
| awaiting_assignment → pending | `PUT /batches/:id/assignments` with ≥1 stitcher + quotas | `SetAssignments` (validates quotas sum to batch quantity) |
| pending → awaiting_assignment | same endpoint, empty list, while still pending | `SetAssignments` |
| stickers printed | `POST /batches/:id/stickers-printed` | `MarkStickersPrinted` (sets `stickers_printed_at`) |
| stitching pending → in_progress | Join by an assignee | `StartPhase` (per-worker index) |
| stitching → packing/pending | The scan that sets the last `stitched_at` | `ScanUnit` (closes all open stitching logs with per-worker counts) |
| packing → completed | The scan that packs the last unit | `ScanUnit` |

**Manual `complete` is cutting-only.** For stitching/packing it returns 400 "… completes automatically when all units are scanned".

## Short-Cut Handling
If a cutter cuts fewer pieces than planned (e.g. roll ended, flaw in cloth), the cutter reports `quantity_completed = N` where `N < quantity`.
The batch pauses in `awaiting_assignment` with a short-cut banner visible to the admin.
Admin selects one of three resolution paths:
1. **Split**: Reduces current batch to `N` units and creates a linked child batch with `quantity = Q - N` (`parent_batch_id = parent.id`).
2. **Reduce**: Clamps batch quantity to `N`, **deletes** the un-cut units, and stores `short_reason`.
3. **Recut**: Keeps batch quantity `Q` and transitions back to cutting so another cutter can cut the remaining pieces.

Every action is confirmed in a dialog and needs a reason (R1/W5): Roll ran out · Material defect · Machine issue ·
Cutter error · Order changed · Other (+ note, required for Other). The reason goes into the batch notes,
`short_reason` (split/reduce) and the `short_resolved` event.

## Batch events (R1, migration 016)
`batch_events` is the typed history every report reads time from. Each transition writes one row in its own tx:

| Kind | Written by | to_phase / to_status | data |
|---|---|---|---|
| `created` | Create · split remainder · rework re-cut | cutting / pending | quantity, parent, via (`split`/`recut`), recut_of |
| `cut_started` | cutter Start (every claim) | cutting / in_progress | |
| `cut_completed` | cutter Complete | stitching / awaiting_assignment | cut, cut_total, quantity, short |
| `short_resolved` | resolve-short | recut → cutting / pending; else unchanged | action, reason, note, remainder, cut, quantity |
| `assigned` | SetAssignments | stitching / pending (or back to awaiting) when the gate flips | phase, `before` / `after` [{worker_id, target_qty}] — quota history (D6) |
| `stitching_started` / `packing_started` | first worker joins the phase | phase / in_progress | |
| `stitching_completed` | last stitching scan | packing / pending | |
| `completed` | last packing scan, or a write-off / re-cut decision that finishes packing | completed / completed | |

- **Stage entry** (WIP ageing) = newest event with `to_phase` = current phase and `to_status` = the stage's entry status
  (`pending`; `awaiting_assignment` for Ready). **Last activity** (stuck) = newest of: any event, unit scan, phase claim,
  rework step. Stuck = last activity older than `app_settings.stuck_hours[stage]`.
- "Completed today" (`/batches/stats`) counts `completed` events by factory day (D5), not `updated_at`.
- Backfilled rows (`data.backfill`) are approximate: stitching/packing start = first scan, completion = last pack scan;
  old `assigned` rows only know the worker count.

## Visibility per status
- `awaiting_assignment`: admin only (Batches → Ready to stitch). Worker queues filter `status IN ('pending','in_progress')`.
- Stitching pending/in_progress: only assigned stitchers.
- Cutting / packing: open queues (unless an assignment exists for that phase — then assignees only).

## Timeline
`GET /batches/:id` → `timeline[]` = every `phase_logs` row with worker name, start/end, duration, quantity.
Multi-worker phases yield multiple rows (two stitching entries: 8 pcs and 2 pcs; a joiner with no scans shows 0 pcs).

## Rework Lifecycle (Slice B — Built & Verified)
- Mat-level lifecycle: `pending` → `packed`, or flagged to `rework`, or written off as `defective`.
- Batch remains in `packing` phase while units are in rework.
- **Rework completion rule**: The packing phase completes when all units in the batch satisfy `status IN ('packed', 'defective', 'dispatched')`.
- Defect routing:
  - Round 1 with stitching fault/stain/other → routes to `bu.stitched_by` (`route='stitcher'`).
  - Round 1 with cutting fault or material defect → routes to admin (`route='admin'`).
  - Round 2+ (escalation) → routes to admin.
- Stitcher repairs the defect and scans the mat (`POST /worker/units/scan`) → `rework_fixed: true`, closes round, resets unit to `pending`.
- Admin decision on `route='admin'` items: `to_stitcher` (reroute to stitcher), `recut` (write off unit + spawn new 1-mat batch), or `write_off` (permanently defective).

