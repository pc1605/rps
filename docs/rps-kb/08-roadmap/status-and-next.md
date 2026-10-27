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

## Next Slices (designs in `remaining-slices.md`)
| Slice | Scope | Est. |
|---|---|---|
| **B** Rework | unit `rework` status, `rework_logs` + photo upload, packer Pack/Rework step, stitcher rework queue, admin visibility, per-unit sticker reprint | ~3 d |
| **C** Materials & BOM | `materials` (types/units), BOM linkage, consumption at cutting-complete (FIFO), stockyard materials tracking | ~3 d |
| **D** Earnings | rates per station/size, ₹ column + date-range wage sheet on Reports (`piece_rates`) | ~1 d |
| **E** Hardening + Deploy | §3 worker auth hardening, §4 admin (httpOnly refresh, secret rotation), Railway (API+PG) + Vercel deployment, EAS build/update, real-device pilot | ~5 d |

## Sequence
1. Verify A/A.2 + scan login (test script) → 2. B (rework) → 3. C (materials) → 4. D (earnings) → 5. seed + Postman → 6. E (hardening, deploy) → pilot week at the factory.

## Owner answers still needed
See `00-project/owner-requirements.md` → Open questions. Most impactful: rework-photo role, printer location, rates per size.
