# Admin Screens — behaviour reference

## Dashboard
Stat cards: In cutting · **Ready for stitching** (amber; the admin's to-do) · In stitching · In packing · Completed today · total active.
Attention cards include **N batches stuck** (R1, from `/reports/stuck`) → Reports overview.

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

## Stock — `/stock`
Finished goods only (packed mats by item), with a pointer to Materials. The old Raw-material/Rolls tab was removed in C2.

## Reports (R1) — `/reports`, `/reports/workers`, `/reports/quality`
Tabs are routes; the date range is URL state (`?from&to`, default last 30 days) and travels between tabs. Every table
has a CSV button (built in the browser). **Thresholds** dialog edits the stuck hours per stage.
- **Overview:** packed / stitched / cut with change vs the previous period, first-pass yield, stuck now · throughput
  per day as three small-multiple bar charts (one series each, phase colours, hover = day value, screen-reader table) ·
  work in progress right now per stage with ageing buckets (<4 h, 4–24 h, 1–3 d, >3 d) → `/batches?view=…` · stuck
  batches list · FPY by week · item mix (packed per car).
- **Workers:** per station table — pieces/mats, days, active time, per hour (≥ 15 min), stitchers: rework rate and
  quota delivered.
- **Quality:** rework rounds, average fix time, short cuts / cuts, write-offs, re-cuts · rework and losses by reason
  (ranked bars) · rework by stitcher · short cuts by action × reason · write-offs & re-cuts by item.
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
- **Lot — `/materials/lots/[id]`** (old `/stock/lots/[id]` redirects): type, width, colour, supplier, cost; remaining/received, used, wasted, adjusted,
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

## Materials (C2) — `/materials`
Tabs are routes: **Stock** `/materials` · **Ledger** `/materials/ledger` · **Types** `/materials/types` · **Recipes**
`/materials/recipes`.
- **Stock:** per-type totals (low flagged; click filters), lots table (remaining bar, cost, last movement), filters in the
  URL (`type`, `low=1`, `all=1` incl. finished lots), **Receive lot** dialog (variant required iff the type has
  variants; qty ≤ 3 dp, cost ≤ 2 dp). Row → lot page.
- **Lot page:** Adjust (new remaining + reason) · Waste · Return · Edit (colour, supplier, cost, note, in use; material /
  width locked once the lot has consumption, waste or returns). Totals, batches, ledger.
- **Ledger:** every movement newest first, material + date filters, shortfalls marked, lots/batches/workers linked.
- **Types:** card per material (unit, stock, low level, active) + edit dialog (Delete only when unused — else it says
  why and points to Active; turning Active off warns about recipe lines / overrides that will be skipped); variants as chips with add/edit (name +
  width in inches → `specs.width_in`, other spec keys kept).
- **Recipes:** product line select (`?line=`), grid material(+width) × consumption group, per-group edit dialog
  (`LinesEditor`: material, any width / specific width, qty > 0) → full replace; PLACEHOLDER warning; consumption groups
  table + new/edit dialog (Delete only with no cars, recipe lines or size default).
- **Car:** item dialog has the consumption group; the car page has **Materials** (engine dry run for N mats: source,
  width, qty/mat, lots it would draw, available, shortfall) + **Edit overrides** (qty ≥ 0, 0 = not used) + Edit.
- **Batch:** **Materials used** per cutting completion (plan × mats, source, lots drawn, shortfall). **New batch:** the
  roll picker lists active lots of the car's sheet material (type code = product line code) and a live "materials at
  cutting" preview shows shortfalls before creating.
- **Dashboard:** low-stock types and 30-day shortfalls (from `/batches/stats`) replace the old per-roll low cards.
