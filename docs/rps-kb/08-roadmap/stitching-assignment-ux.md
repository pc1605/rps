# Stitching assignment UX — hand-off (Nov 2026)

Status: **built on `agent/slice-u3` (Nov 2026)** — owner answers and what shipped are at the end. Original hand-off below. Read `AGENTS.md` and `NEXT-STEPS.md` first. Master has C1, U1, U2, C2, R1 merged
(local, not pushed); the `rps` dev DB is on migration 016.

## Where it lives today
- UI: `apps/admin-web/features/batches/components/assign-stitchers-card.tsx` (178 lines), rendered on the batch page
  `app/(dashboard)/batches/[id]/page.tsx` below `ShortCutPanel`, only when `current_phase = stitching`.
- API: `PUT /batches/:id/assignments {phase, assignments: [{worker_id, target_qty?}]}` → `SetAssignments` in
  `apps/backend/internal/batch/service.go`. Rules: quotas all-or-none and must sum to `quantity`; a target can't drop
  below what that worker has stitched; a worker with stitched mats can't be removed; stitching flips
  `awaiting_assignment ↔ pending`; blocked while a short cut is unresolved. Writes an `assigned` batch event with
  `before` / `after` targets (R1, D6) + audit row.
- Ready list: `/batches?view=ready` (`features/batches/components/batch-list.tsx`), dashboard "Ready to stitch" card.
- Stitchers join via the phone (`StartPhase`, assignment gate: only assignees may join) and scan mats (`ScanUnit`).
- Worker data: `GET /workers` (station, is_active), worker page `/workers/[id]` (U1), `GET /workers/:id/summary`.

## Problems (from the owner walkthrough)
1. **One batch at a time** — Ready to stitch is a list; every batch must be opened to assign it.
2. **No idea who's free** — stitchers listed alphabetically; no open workload, on-floor status or today's output.
3. **Too much typing** — "give it all to Mahesh" = tick + type the full count; several people need hand-typed numbers
   that must balance exactly; *Split evenly* gives the remainder to the first ticked, not the least busy.
4. **Reassigning is manual maths** — someone with stitched mats can't be unticked; lower their number, raise another's.
5. **Two unclear buttons** — "Save" vs "Assign & print labels" mixes assigning with label printing.
6. **Quotas forced** — backend allows a shared pile (no per-person targets); the card always demands numbers.
7. **Buried + off-tokens** — mid-page; `text-amber-600` for "not balanced", `text-[10px]`, mono uppercase heading
   (audit C1; amber = "act here" only).
8. **No packing assignment UI** although the backend supports it.

## Proposal
**A. Assign from the Ready list.** `/batches?view=ready` becomes an assigning screen: car name large, mats, waiting
time; **Assign** opens a side panel (Sheet) — never leave the list, assign several in a row.

**B. New assign panel** (shared with the batch page):
```
 Assign B-2026-041 · Hyundai Creta · 12 mats          waiting 3 h
 ─────────────────────────────────────────────────────────────────
 ☑ Mahesh   ● on floor   4 open · 18 today      [  6 ]  ▓▓▓▓▓░░░
 ☑ Surya    ● on floor   0 open ·  9 today      [  6 ]
 ☐ Ravi       absent?    0 open ·  0 today
 ─────────────────────────────────────────────────────────────────
 Split: ███████ Mahesh 6 | ███████ Surya 6        12 / 12 ✓
 ○ Fixed share each (quota)   ○ Shared pile (anyone picks)
 [ Print labels after ]                            [ Assign 12 mats ]
```
- sorted by load (least open work first, then on floor);
- tick one → whole batch, nothing to type; tick several → auto even split, remainder to the least busy; editing one
  number rebalances the others so the total always fits; split bar shows it;
- shared-pile option (no targets); one primary button, label printing as a remembered checkbox.

**C. Mid-stitching changes.** Each row shows done / target; **Move remaining to…** lowers that person to what they've
done and gives the rest to the chosen stitcher. Same action on the worker page = "hand over all of X's open stitching
work" (owner: an absent stitcher's remaining quota goes to someone else). Each change writes an `assigned` event.

**D. Backend.** `GET /stitchers/load` → per active stitcher: open mats left (across live stitching batches), batches,
on floor now (open phase_log), last scan, mats today. Hand-over endpoint for C. No migration expected.

**E. Later:** the same panel for packing.

## Open questions for the owner (ask first)
1. List + side panel enough, or a drag-and-drop board (ready batches → stitcher columns)?
2. Default mode: fixed share each (today) or shared pile?
3. When are taffeta labels printed — at assignment, or earlier at cutting?
4. Anything in their own picture of the flow this misses?

## Related answers already given (U3 discussion)
- Cancelling a batch after cutting: owner **and** supervisors (owner said "yes" — confirm wording).
- Absent stitcher mid-batch: remaining quota is reassigned to someone else (→ C above).
- Workers should see their own output (and later earnings) on the phone — planned for U3 / Slice D.
- The wider U3 plan (edit/cancel batch, release claim, undo last scan, My work screen) is paused until this is done.

## Owner answers (Nov 2026) → what was built
1. List + side panel (no board) → Ready list `?phase=ready` with **Assign** → `AssignSheet`; same panel on the batch page.
2. Default **fixed share each**; shared pile is a toggle.
3. Labels print **at assignment** → "Print labels after" checkbox on the first assignment, remembered.
4. **Packing assignment dropped** (owner: it would complicate the process) → D31. Part E is not planned.

Built: `GET /stitchers/load`, `ready_since` + `sort=waiting` on `GET /batches`, `POST /stitching/hand-over`,
`GET /stitchers/:id/open` (API in `03-backend/api-reference.md`); panel rules in `04-admin-web/screens.md`;
decisions D31–D32. Problems 1–7 addressed; 8 dropped (D31). No migration.

