# Status & Next Steps (as of 2026-09-13)

## Built and verified (end-to-end tested by the developer)
- Weeks 1–7: auth (admin + worker), batches/units, worker app, phase state machine, stock (rolls + finished), batch timeline,
  QR taffeta labels (PDF), camera scanner, packer per-unit scans, worker productivity reports.
- Week 8: multi-worker stitching/packing (join model), scan-per-mat at stitching, per-worker attribution, `piece_rates` table,
  admin unit grid with stitched/packed names, cross-batch scan guard, scanner feedback fixes.

## Built, compiles, **UI verification pending**
- **Slice A** (assignment gate): `awaiting_assignment`, `batch_assignments`, `SetAssignments`, visibility filter, sidebar phase sub-nav
  with counts, AssignStitchersCard, taffeta-at-assign, packing stickers + `stickers_printed_at`, mobile 📌 states.
- **Slice A.2** (quotas): `target_qty`, sum/floor/no-remove rules, scan-time quota gate, quota inputs + Split evenly, mobile share display, blue quota flash.
- **QR enrollment**: `RPS-ENROLL:` QR on create + Workers list, `GET /workers/:id/enrollment`, `enroll-scan.tsx`, store-backed login field.
- Scanner black-preview fix (stable `onBarcodeScanned`) and quota flash header fix.

→ **First task for whoever picks this up:** run the full manual test in `06-operations/testing.md`, fix what breaks, update the
Postman Multi-Worker folder for the gate + quotas, commit `[week9] slice A + A.2 verified`.

## Remaining slices (designs in `remaining-slices.md`)
| Slice | Scope | Est. |
|---|---|---|
| **B** Rework | unit `rework` status, `rework_logs` + photo upload, packer Pack/Rework step, stitcher rework queue, admin visibility, per-unit sticker reprint | ~3 d |
| **C** Materials & BOM | `materials` (types/units), car-model CRUD with BOM, consumption at cutting-complete (FIFO), stock UI rework | ~3 d |
| **D** Earnings | rates per station (and per size if owner wants), ₹ column + date-range wage sheet on Reports | ~1 d |
| **E** Hardening + Deploy | §3 worker auth (is_active check, one-time codes, rate limit, PIN reset UI), §4 admin (httpOnly refresh, secret rotation), Railway (API+PG) + Vercel, EAS build/update, real-device pilot | ~5 d |
| — | New demo seed for the current schema; Postman updates; `packages/shared` types | ~1 d |

**≈ 14 working days to factory-usable.** Full-time → end of September 2026; part-time → late October.

## Sequence
1. Verify A/A.2 + scan login (test script) → 2. B (rework) → 3. C (materials) → 4. D (earnings) → 5. seed + Postman → 6. E (hardening, deploy) → pilot week at the factory.

## Owner answers still needed
See `00-project/owner-requirements.md` → Open questions. Most impactful: rework-photo role, printer location, rates per size.
