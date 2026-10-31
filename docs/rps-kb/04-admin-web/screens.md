# Admin Screens — behaviour reference

## Dashboard
Stat cards: In cutting · **Ready for stitching** (amber; the admin's to-do) · In stitching · In packing · Completed today · total active.

## Batches (list) — `/batches[?phase=…]`
Sidebar sub-nav: Cutting · Ready to stitch · Stitching · Packing · Completed, each with a live count pill (from `/batches/stats`).
No `phase` param → all batches. Table columns: Code (link) · Model/size · Qty · Phase badge (amber **ready** for parked) ·
Packed n/m · Created. **Packing view only**: extra column **Print stickers** → downloads sticker PDF and POSTs
`stickers-printed` → label flips to **Reprint**.
**U2 — URL is the state** (`features/batches/use-list-params.ts`): `phase`, `q` (debounced), `car`, `line`, `from`, `to`,
`rework=1`, `short=1`, `sort`, `order`, `page` → server-side `GET /batches` (50 per page, "x–y of N", Prev/Next).
Sortable headers (Code, Model, Qty, Phase, Created). Whole row opens the batch (ctrl/⌘/middle-click → new tab).

## Batch detail — `/batches/[id]`
- Header: code, model · qty · size, notes; **Labels PDF** (taffeta reprint); badge shows `ready for stitching` when parked.
- **Short-cut panel** (`ShortCutPanel`): renders when `cut_qty < quantity` and `current_phase === "stitching"`. Displays amber warning banner with short piece count, and three resolution actions (`Split`, `Reduce`, `Recut`) triggering `POST /batches/:id/resolve-short`.
- **Stitching assignment card** (only while `current_phase === "stitching"`):
  - pulsing "Ready for stitching — assign to release" while parked
  - one row per active stitcher: checkbox, `N done ·` (if any), quota input (`min` = done)
  - footer `8 / 10 mats assigned · 2 left` (amber) → `10 / 10 ✓` (green); **Split evenly**
  - **Save** (disabled unless balanced or empty) · **Assign & print labels** (disabled unless balanced) → PUT then taffeta PDF
  - unchecking a stitcher with done > 0 is blocked with a toast (server enforces too)
- **Production timeline**: one card per phase_log (icon/color per phase, worker, times, duration, pcs, notes; dashed/pulsing when open).
- **Units grid**: `unit_code` · badge `pending | stitched (pink) | packed (lime) | defective | dispatched` · `🧵 stitched_by_name` · `📦 packed_by_name`.

## Cars (Catalog) — `/cars`
Catalog management of flat car items.
- Table: Brand · Car model · Size (`S` / `M` / `L`) · Product line (`Rexine (R)`, `PVC 1.8 mm`) · Barcode (mono 12-digit sequence or custom) · Status (`Active` / `Inactive`) · Edit button.
- **Add / Edit Item dialog** (`ItemDialog`): Brand select or inline new brand creation, car model name, size class, pieces per set (default 4), product line select, barcode input with "Generate on save" wand helper. Programmatic `<Label htmlFor="…">` and `<form onSubmit>` handling.

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

## Entity pages & links (U1)
Every worker / batch / unit / car / lot name is a link (`components/rps/entity-link.tsx`: `WorkerLink`, `BatchLink`,
`UnitLink`, `CarLink`, `LotLink` — neutral style, never amber). Pages use `PageHeader crumbs` (breadcrumbs); batch
detail crumbs go back to the batch's own phase view.
- **Worker — `/workers/[id]`**: Now (open claims with my_done/target, assigned-not-joined, open rework) · Output
  (range picker; today / 7 days / range / per active hour; stitchers rework caused (rate, reasons) + fixed (median
  turnaround); packers sent-to-rework; per-day bars in the station colour) · Work history (load more). Actions:
  Enrollment QR, Reset PIN (shown once), Edit (name, phone, station), Deactivate/Reactivate (AlertDialog; refused
  while the worker has open work).
- **Unit — `/units/[code]`**: journey — batch created → cut (who, pieces, roll) → stitched → rework rounds (reasons,
  note, photos/lightbox, decision, re-cut batch link, fixed by) → packed.
- **Car item — `/cars/[id]`**: size, line, pieces, consumption group, barcode; range stats (stitched, packed, rework
  rate, first-pass yield, in production, in stock); active + recently completed batches.
- **Lot — `/stock/lots/[id]`**: type, width, colour, supplier, cost; remaining/received, used, wasted, adjusted,
  returned; batches that used it; ledger (load more).
- `components/ui/card.tsx` is a plain surface (no default flex-col) — callers own padding and layout.

## Lists & search (U2)
- **Whole-row links** on every table: `DataTable rowHref` (+ `rowLabel`). Clicks on inner links, buttons, inputs,
  switches, checkboxes and portal content (dialogs opened from a row) never trigger the row. Workers → worker,
  cars → car, reports → worker, stock rolls → lot, rework "With stitchers" → mat, worker history / car / lot batch
  tables → batch. The lot ledger isn't clickable (most movements have no batch).
- **Header search** (`components/layout/global-search.tsx`): batches, mats, cars (incl. barcode), workers, lots; arrow
  keys + Enter; exact match first. A USB scanner's "code + Enter" (before results arrive) fetches and opens the exact
  match. No ⌘K / shortcuts yet (deferred in NEXT-STEPS).
- The dashboard no longer loads the full batch list: recent = `?limit=6`, short cuts = `?view=ready&short=true`,
  pipeline names = `stats.working`.
