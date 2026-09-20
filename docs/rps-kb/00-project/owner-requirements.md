# Factory Owner Requirements (post-demo, Sept 2026)

The first demo produced a redesign of the flow. These are the owner's stated requirements, the revised flow, and
questions still open. Treat these as the source of truth for product direction.

## The five points from the demo
1. **Phase tabs** — easy view of batches per phase. → Built as sidebar sub-navigation under Batches with live counts.
2. **Raw materials are many kinds** — not just rexine rolls: velcro tape, thread, piping rexine, etc. → Slice C (not built).
3. **Taffeta labels print at assignment** — when admin assigns cut mats to a stitcher, so mats + labels travel together. → Built.
4. **Rework** — packer inspects each mat: Done or Rework. Rework: photo of fault + reason; stitcher fixes; returns to packing. → Slice B (not built).
5. **Admin adds car models dynamically**, setting material usage (BOM) per car. → Slice C (not built).

## The revised flow (owner-confirmed)
```
Admin creates batch
→ Cutter: Start → Complete (open queue)
→ Batch returns to ADMIN: "Ready for stitching" (status awaiting_assignment; stitchers see nothing)
→ Admin assigns stitcher(s) WITH per-head quotas (e.g. Surya 8, Raj 2) → taffeta labels print now
→ Assigned stitchers: Join → scan each mat as finished (quota enforced)
→ Packing stickers print when batch enters packing (strip stays at packing table)
→ Packer: scan each mat → Pack ✓  |  Rework ✗ (Slice B)
→ All packed → completed
```

## Decisions the owner made explicitly
- **Strict assignment, not self-service.** Reason: with an open list, workers cherry-pick small/easy car mats. Stitchers must only see what's assigned to them.
- **Per-head quotas** ("8 by Surya, 2 by Raj"), strictly enforced.
- **Packing sticker must carry full details** (same as taffeta — unique per mat), one bag per mat.
- Stitching split is by **whole mats** (one stitcher completes a whole mat); the old "left/right piece groups" idea is dead → `car_models.piece_groups` can be deleted.

## Open questions (ask at next meeting)
1. **Rework photo** — owner said "cutter will click image"; designed as *packer* photographs at flagging. Confirm who.
2. **Does packing ever get divided** between packers (needs quota/assignment too)?
3. **Printer location** — office desk vs packing table. Decides whether per-scan sticker printing (kiosk station) is worth it.
4. **Piece rates per car size?** (Ertiga vs Alto) and which stations are piece-paid. Feeds Slice D (Earnings) and removes cherry-picking motive.
5. **Rexine measurement method** at cutting (metres used) — gates consumption accounting in Slice C.
6. **Rework frequency and process** details (does a re-cut ever happen?).
7. **Supervisor accounts** — who else needs admin access.
8. **Per-head quota vs "just permission"** — quotas are built; confirm they want them mandatory or optional per batch.
