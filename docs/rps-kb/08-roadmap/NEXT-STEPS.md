## Next, in order (updated after the product audit — see docs/rps-kb/10-product-audit/audit.md)

| #   | Slice                     | Contains                                                                                                                                                                                                             | Depends on | Folder               |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- |
| U0  | Bugs & quick fixes        | F15 stitching completion (data correctness), F04 BatchStats type, mobile queue sort, other S-effort correctness fixes                                                                                                | —          | main                 |
| C1  | Materials backend         | C1a schema (migration 015) + shared types · C1b recipe resolution + consumption engine · C1c endpoints                                                                                                               | U0 merged  | worktree `../rps-c1` |
| U1  | Entity pages & navigation | Worker page (current work, pipeline history, output, rework caused/fixed, enrollment QR, PIN reset, activate), Unit/Mat, Car item, Lot pages; every worker/batch/unit/car/lot name clickable everywhere; breadcrumbs | U0         | main                 |
| U2  | Lists                     | whole-row click on every table, header search (batch code, unit code, barcode, worker, car), filters+sort in URL, server pagination for batches                                                                      | U1         | main                 |
| C2  | Materials admin screens   | Materials (types, variants, lots, receive/adjust, movements), Recipes grid, groups + overrides in car dialog, "Materials used" on batch                                                                              | C1, U1, U2 | main                 |
| R1  | Reports v2                | WIP ageing + stuck batches (also on dashboard), throughput, cycle time per phase, first-pass yield, worker output/hour, short-cut rate; CSV export                                                                   | U2         | main                 |
| U3  | Workflow gaps             | edit batch before cutting, cancel after cutting, reassign mid-stitching, supervisor undo last scan                                                                                                                   | U2         | main                 |
| C3  | Cutter materials          | "You'll need …" panel, roll QR scan at cutting start, lot QR labels                                                                                                                                                  | C2         | main                 |
| R2  | Material reports          | consumption vs recipe, waste, cost per mat                                                                                                                                                                           | C2         | main                 |
| E   | Hardening & deploy        | E1 security · E2 deploy · E3 EAS · E4 factory pilot                                                                                                                                                                  | U3         | main                 |

Parallel rule: two agents may run at once only in separate folders (git worktree) on separate branches,
and only when they don't touch the same files. Merge order: U0 → C1 → U1 → U2 → C2 → …

### Decisions taken (defaults until the owner says otherwise)

- "Stuck" batch: no activity for 24 h in cutting, 48 h in stitching/packing (to be made configurable in R1).
- Search covers batch code, unit code, barcode, worker name, car name.
- Worker pages are admin-only.
- Deferred (not over-engineering now): ⌘K palette & keyboard shortcuts, audit-log viewer, live updates (WebSocket),
  full settings page, pagination outside the batch list.

### Open owner questions (from the audit)

- What happens to a stitcher's remaining quota when they're absent mid-batch?
- Who may cancel a batch after cutting (owner only, or supervisors too)?
- Should workers see their own output/earnings on the phone?
- What counts as a "late" batch (due dates per order?)
