# Admin Screens — behaviour reference

## Dashboard
Stat cards: In cutting · **Ready for stitching** (amber; the admin's to-do) · In stitching · In packing · Completed today · total active.

## Batches (list) — `/batches[?phase=…]`
Sidebar sub-nav: Cutting · Ready to stitch · Stitching · Packing · Completed, each with a live count pill (from `/batches/stats`).
No `phase` param → all batches. Table columns: Code (link) · Model/size · Qty · Phase badge (amber **ready** for parked) ·
Packed n/m · Created. **Packing view only**: extra column **Print stickers** → downloads sticker PDF and POSTs
`stickers-printed` → label flips to **Reprint**.

## Batch detail — `/batches/[id]`
- Header: code, model · qty · size, notes; **Labels PDF** (taffeta reprint); badge shows `ready for stitching` when parked.
- **Stitching assignment card** (only while `current_phase === "stitching"`):
  - pulsing "Ready for stitching — assign to release" while parked
  - one row per active stitcher: checkbox, `N done ·` (if any), quota input (`min` = done)
  - footer `8 / 10 mats assigned · 2 left` (amber) → `10 / 10 ✓` (green); **Split evenly**
  - **Save** (disabled unless balanced or empty) · **Assign & print labels** (disabled unless balanced) → PUT then taffeta PDF
  - unchecking a stitcher with done > 0 is blocked with a toast (server enforces too)
- **Production timeline**: one card per phase_log (icon/color per phase, worker, times, duration, pcs, notes; dashed/pulsing when open).
- **Units grid**: `unit_code` · badge `pending | stitched (pink) | packed (lime) | defective | dispatched` · `🧵 stitched_by_name` · `📦 packed_by_name`.

## Workers
Table: name · station badge · active · last login · **QR icon** → EnrollmentQrDialog (fetches `/workers/:id/enrollment`, shows
`RPS-ENROLL:` QR + copyable text). Create dialog → success view shows QR + text code + instructions.

## Stock
Raw tab: rolls with progress bar, `⚠ Low` under 10 m, create/edit. Finished tab: packed units by model.
(Slice C replaces "rolls" with generalized materials + BOM.)

## Reports
Range presets (Today / 7d / This month / 30d / custom) → table per worker: batches, pieces, avg/batch, 🏆 top producer,
pulsing "working" dot (open claim, independent of range). Summary strip: Pieces · Phase runs · On floor now.
(Slice D adds ₹ earnings via `piece_rates`.)
