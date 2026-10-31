# Status & Next Steps (as of 2026-09-13)

## Built and verified (end-to-end tested by the developer)
- Weeks 1–7: auth (admin + worker), batches/units, worker app, phase state machine, stock (rolls + finished), batch timeline,
  QR taffeta labels (PDF), camera scanner, packer per-unit scans, worker productivity reports.
- Week 8: multi-worker stitching/packing (join model), scan-per-mat at stitching, per-worker attribution, `piece_rates` table,
  admin unit grid with stitched/packed names, cross-batch scan guard, scanner feedback fixes.

## Built and verified (end-to-end tested)
- **Weeks 1–7**: Auth (admin + worker), batches/units, worker app, phase state machine, stock (rolls + finished), batch timeline, QR taffeta labels (PDF), camera scanner, packer per-unit scans, worker productivity reports.
- **Week 8**: Multi-worker stitching/packing (join model), scan-per-mat at stitching, per-worker attribution, `piece_rates` table, admin unit grid with stitched/packed names, cross-batch scan guard.
- **Slice A & A.2** (Assignment gate & quotas): `awaiting_assignment` state, `batch_assignments`, `SetAssignments`, visibility filter, sidebar phase sub-nav with live counts, `AssignStitchersCard`, taffeta-at-assign, packing stickers + `stickers_printed_at`, mobile share display (`📌 Your share: 3/8`), strict quota gate, blue quota flash.
- **QR Enrollment**: `RPS-ENROLL:` QR on worker creation + Workers list dialog, `GET /workers/:id/enrollment`, `enroll-scan.tsx`, store-backed login field.
- **Short-Cut Handling**: Cumulative `cut_qty`, `parent_batch_id`, `short_reason`, `ShortCutPanel` with three admin resolution actions: `split` (creates remainder batch), `reduce` (clamps target and cancels un-cut units), `recut` (re-opens cutting queue).
- **Catalog Management**: Flat items on `car_models` (`/cars`), `product_lines` table (`REX-R`, `REX-87`, `PVC-18`, `PVC-21`), `ItemDialog` with brand creation, 12-digit scanner-safe barcode generation (`car_barcode_seq` with Luhn check).
- **Monorepo Shared Package**: `@rps/shared` (`packages/shared/`) providing single source of truth for labels, statuses, sizes, and domain constants.
- **Tooling & CI**: golangci-lint, Biome linting, Prettier formatting, lefthook pre-commit automation, monorepo typecheck scripts (`pnpm typecheck`), and `TestReadQueriesSmoke` query smoke test.
- **Design System & A11y (P1–P5)**: WCAG AA contrast compliance across light and dark modes on web and mobile, strict "act here" amber rule, programmatic form labels and button types, keyboard navigable DataTables, reduced-motion overrides, and Android font scaling support (`minHeight`).
- **Slice B (Rework & Defect Management)**:
  - Unit-level `rework` and `defective` states (migration 012), `rework_logs` (rounds, reasons, notes, route, decision), `rework_photos` storage.
  - Packer unit peek (`GET /worker/units/:code/peek`) with Pack vs Rework action sheet.
  - Mobile photo capture with camera hand-off race fix (`useCameraReady()`) preventing black preview on navigation.
  - Reason-based routing: stitching faults/stains to original stitcher; cutting faults/material defects to admin; round 2+ automatic admin escalation.
  - Stitcher rework queue (`GET /worker/rework`) and fix scan returning `rework_fixed: true`.
  - Admin rework table (`/rework`) with photo preview, filtering (`open`/`all`, `admin`/`stitcher`), and decisions (`to_stitcher`, `recut` spawning 1-mat batch, `write_off`).
  - HMAC-SHA256 signed photo URLs (`/api/v1/files/rework/:name?exp=&sig=`) allowing public caching without auth header issues.
  - Housekeeping: Updated comprehensive Postman collection with 100% pass rate; self-sufficient seeds (`seeds/01-catalog.sql`, `seeds/02-demo.sql`), `scripts/seed-dev.sh`, and `scripts/seed-uploads.sh`.

## Next Slices (designs in `remaining-slices.md`)
| Slice | Scope | Status / Next |
|---|---|---|
| **B** Rework | unit `rework` status, `rework_logs` + photo upload, stitcher queue, admin decisions, signed URLs | **DONE** |
| **E** Hardening + Deploy | §3 worker auth hardening, §4 admin refresh token rotation, Railway (API+PG) + Vercel deployment, EAS build/update, real-device pilot | **Recommended Next** |
| **C** Materials & BOM | `materials` (types/units), BOM linkage, consumption at cutting-complete (FIFO), stockyard materials tracking | Blocked on owner numbers |
| **D** Earnings | rates per station/size, ₹ column + date-range wage sheet on Reports (`piece_rates`) | Follows C / E |

## Sequence
1. Slices A & B verified end-to-end (Postman + demo seed + smoke tests pass).
2. **Next step**: Either proceed with **Slice E** (production hardening, Railway/Vercel deployment, and factory pilot APK build) OR unblock **Slice C** once owner provides BOM specifications.

## Open Owner Questions
1. **Languages**: Should the worker app support Hindi, Gujarati, or remain English-first with icon-heavy cues?
2. **Re-cut Process**: When admin decides to recut, should the new 1-mat batch automatically assign the original cutter or enter the general cutting pool?
3. **Photo Required?**: Is photo capture strictly mandatory (1–3 photos) for every rework flag, or can minor flaws be submitted with text-only?
4. **Quick-Pack Toggle**: Should high-volume packers have a "Quick Pack" mode toggle that skips the peek modal and packs immediately on QR scan?
5. **Portrait Lock**: Should the Android worker app be strictly locked to portrait orientation via manifest to prevent accidental rotation in hand-held factory use?

