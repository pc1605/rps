# RPS — what it can and cannot do

**RPS (Riddhi Production System)** tracks car floor-mat production at Riddhi Car Floor Laminates (Ambika Enterprise),
Ahmedabad. It has two parts:

- **Admin website** — for the owner and supervisors, in the browser on a laptop, computer or tablet.
- **RPS Worker phone app** — for cutters, stitchers and packers, on Android phones.

This document describes RPS **as of 28 November 2026**. "Cannot" means it is not available in RPS on that date.

---

## 1. How work flows through RPS

1. The admin creates a **batch**: one car item (e.g. "Baleno, Rexine R") × a number of mats. Every mat gets its own
   code (e.g. `B-2026-005-003`) from the start.
2. **Cutting**: the new batch waits as "Needs a cutter" until the admin assigns one cutter; that cutter gets a
   notification, presses Start, cuts, then enters how many pieces were cut and presses Complete. The batch goes back
   to the admin as "Ready for stitching".
3. The admin **assigns stitchers**, either a fixed share each (e.g. Surya 8, Raj 2) or a shared pile, and prints the
   fabric (taffeta) labels.
4. **Stitching**: each assigned stitcher joins the batch and scans each mat's label when the mat is finished. Each
   stitcher can do only their own share.
5. **Packing**: the admin prints packing stickers; the packer scans each mat and either packs it or sends it to
   **rework** with photos.
6. When every mat is packed (or written off), the batch is **completed** and the mats count as finished stock.

---

## 2. Admin website — can do

**Dashboard**
- Counts per stage: needs a cutter, in cutting, ready for stitching, in stitching, in packing, completed today.
- Warnings: stuck batches, short cuts, rework waiting for a decision, low material stock, material shortfalls.

**Batches**
- Create a batch (car item, quantity, which roll to cut from, notes). Before creating, it shows the materials the
  batch will need and any shortfall.
- Lists per stage (Needs a cutter, Cutting, Ready to stitch, Stitching, Packing, Completed, Cancelled) with live counts.
- Search, filter (car, product line, dates, rework, short cut) and sort; 50 per page.
- **Edit** a batch only before cutting starts (item, quantity, roll, notes).
- **Cancel** a batch until the first mat is packed. Cut and stitched mats become **spare stock**, never lost; it shows
  the outcome before you confirm.
- **Release** a cutting batch that a cutter started but cannot finish; it goes back to Needs a cutter.
- **Short cut** (fewer pieces cut than ordered): the admin chooses **Split** (the rest becomes a new batch),
  **Reduce** (the batch becomes smaller) or **Re-cut** (back to cutting for the missing pieces). A reason is required.
- **Undo a scan** made by mistake, with a reason, only until the next stage has started on that mat.
- Batch page: full timeline (who did what, when, how long), every mat with who stitched and packed it, and the
  materials used.

**Assigning cutters**
- Every new batch waits in **Needs a cutter** until the admin picks one cutter for it; only that cutter sees it.
- The panel shows each cutter's open batches, mats left to cut and pieces cut today.
- Change or remove the cutter until cutting starts. A batch given back, released, re-cut or split goes back to
  Needs a cutter.
- When a cutter gives a batch back, the batch page shows who, when and why (the reason the cutter picked, and their
  note).

**Assigning stitchers**
- Pick stitchers; the panel shows who is on the floor today and how busy each is.
- Fixed share each (split evenly, or typed by hand) or a shared pile.
- Change shares later; a share cannot go below what that stitcher already did.
- **Hand over** a stitcher's remaining work to another stitcher (e.g. someone is absent), for one batch or all.

**Labels (as PDF files)**
- Taffeta labels (QR + mat code + car) when stitchers are assigned; reprint any time.
- Packing stickers for the packing table; reprint any time.
- Prints on A4 for now; no label printer is connected.

**Rework**
- See every mat in rework with the packer's photos, reasons and note.
- For mats sent to the admin, decide: **back to the stitcher**, **re-cut** (makes a new 1-mat batch) or **write off**.

**Workers**
- Add workers (cutter, stitcher or packer) with a 4-digit PIN; edit, reset the PIN, deactivate or reactivate.
  Deactivation stops their phone at once.
- **Set up phone**: shows a one-time code (QR + 6 digits, valid 10 minutes, works once) that the worker scans in front
  of the admin.
- Worker page: current work, output for any date range, output per hour, rework they caused or fixed, full history.

**Car items (catalogue)**
- Add and edit car items: brand, model, size (S/M/L), mats per set, product line, barcode (or generate one),
  active/inactive, material group.
- Car item page: production numbers, rework rate, stock, active batches, and the materials it uses.

**Materials**
- Material types (rexine, PVC, piping, velcro, thread …) with units and low-stock levels; variants such as roll width.
- Receive lots (rolls, boxes) with colour, supplier and cost; adjust, record waste, record returns.
- **Recipes**: how much of each material one mat uses, per product line and size group, with per-car exceptions.
- Material is deducted automatically when cutting is completed: from the roll picked on the batch, or else the oldest
  roll first. Shortfalls are recorded and shown.
- Full movement ledger for every lot.

**Stock**
- Finished mats per car item.
- **Spare mats** from cancelled batches: reuse them automatically on a new batch for the same car item, or write them off.

**Reports**
- Any date range; every table downloads as CSV (opens in Excel).
- Overview: cut / stitched / packed with change vs the previous period, output per day, work in progress per stage
  with how long it has waited, stuck batches, first-pass quality, packed mats per car item.
- Workers: output per worker, days worked, output per hour, stitcher rework rate, quota delivered.
- Quality: rework by reason and by stitcher, average fix time, short cuts, write-offs, re-cuts.
- "Stuck" thresholds per stage can be changed by the admin.

**Everywhere**
- Search box for batches, mat codes, cars (also by barcode; a USB barcode scanner works), workers, lots.
- Every name and code is a link to its page.
- Pages update by themselves within a second when work happens on the floor (live updates).
- Light and dark mode; works on a phone browser too.
- Owner and supervisor accounts, with a secure login (too many wrong passwords block that address for 15 minutes).

## 3. Phone app (RPS Worker) — can do

**For every worker**
- English or Hindi (switch any time).
- Set up once in front of the admin (scan the one-time code, then PIN); stays signed in for 30 days.
- One phone per worker: signing in on a new phone signs the old one out.
- **My work** card: today's and this week's count; tap for a month-by-month history (same numbers the admin sees).
- Live updates: new work appears by itself while the app is open.
- **Notifications**, also with the app closed: "New batch assigned to you" and "Rework mat to fix", in the phone's
  language; tapping opens the batch or mat.
- Torch in the scanner; scanning checks wrong batch, wrong label and duplicates on the spot, with colour, sound and
  vibration feedback.

**Cutter**
- Sees only the batches the admin assigned to them (a notification arrives); Start → Complete with the number of
  pieces cut.
- Can give a started batch back to the admin, saying why: machine problem, material problem, too much work, shift
  over, or other (with a note).

**Stitcher**
- Sees **only** batches assigned to them, with their share (e.g. 3 / 8).
- Joins and scans each mat when finished; stops automatically when their share is done.
- Sees rework mats sent back to them, with the packer's photos and reason; fixes the mat and scans it.

**Packer**
- Sees the packing queue; joins and scans each mat to pack it.
- Sends a faulty mat to rework: 1–3 photos, reason(s), optional note. Stitching faults go straight back to the
  stitcher who sewed it; cutting or material faults, and second-time faults, go to the admin.
- The queue shows which batches only wait for rework.

---

## 4. Cannot do (not available today)

**Money and business**
- No wages, earnings, piece rates or any ₹ amounts anywhere. RPS counts work; the owner pays from the counts.
  *(Owner's decision, D40.)*
- No billing, invoices, GST or accounting. RPS only covers production; billing is done in a separate tool (Vyapar today).
  The packed-mats-per-item CSV can be handed to billing.
- No sales orders, customers, dispatch or delivery tracking. Finished mats stop at "stock".
- No purchase orders or supplier management (suppliers are only a text field on a material lot).
- Material reports such as cost per mat, planned vs actual use, or waste reports are not available.

**Admin and accounts**
- Admin and supervisor accounts cannot be created or changed from the website, and admins cannot change their own
  password there. The developer does it.
- Owners and supervisors have the same powers; there are no finer permissions.
- No audit-log screen (changes are recorded but there is no page to browse them).
- Not in other languages on the admin website (English only).

**Stations and assignments**
- Packing is an open queue. Cutting is assigned by the admin (one cutter per batch, no shares); stitching is assigned
  with shares.
- A batch is one car item; mixed batches are not possible.
- No machine integration (cutting machine, scales) and no label printer connection; labels are PDFs,
  printed from a computer or tablet to any printer that device can use.

**Phone app**
- Android only; no iPhone app.
- Not on the Play Store; the app is installed from a file shared by the admin.
- Needs internet to scan. No offline scanning; scans are not saved for later.
- No notifications for packers (their queue is open), and no notifications to the admin.
- Workers cannot see other workers' output, and never see money.
- A worker cannot sign in on two phones at once.

**Server**
- RPS is live at **https://rps.riddhicarmats.com** since 27 November 2026 (admin website and phone app). The
  database is copied every night, also to storage outside the server.
- The server is a trial in Sydney, so each action takes a little longer (about half a second). It moves to Mumbai
  before 25 May 2027; the address stays the same and the phones need no new app.

---

## 5. Words used in RPS

- **Batch** — one production order: one car item × N mats.
- **Unit / mat** — one mat in a batch, with its own code and QR label.
- **Car item** — a car model in one product line (e.g. Baleno · Rexine R), with size S/M/L and a barcode.
- **Product line** — the material family of the mat: Rexine (R), Rexine (87), PVC 1.8 mm, PVC 2.1 mm.
- **Taffeta label** — fabric QR label stitched into the mat during stitching.
- **Packing sticker** — paper QR sticker put on the bag at packing; it also shows the car item's barcode (Code128).
- **Share / quota** — how many mats of a batch one stitcher must stitch.
- **Hand over** — moving a stitcher's remaining share to another stitcher.
- **Short cut** — fewer pieces cut than the batch needs.
- **Rework** — a faulty mat sent back for fixing; **round 2** = it came back a second time.
- **Write off** — a mat that cannot be used; removed from the count.
- **Spare stock** — cut or stitched mats from a cancelled batch, kept for reuse.
- **Lot** — one roll, box or pack of a material.
- **Recipe** — how much of each material one mat uses.
- **Stuck** — a batch with no activity for longer than its stage allows (24 h cutting/ready, 48 h stitching/packing by default).
- **First-pass yield** — share of mats packed without ever going to rework.
