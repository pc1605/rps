# Worker Flows (as built)

## Enrollment (once per phone)
Login → **📷 Scan enrollment code** → camera → admin's QR (`RPS-ENROLL:<badge>`) → back with code filled (accent border)
→ or type the code → PIN (4 digits) → **Set up this phone →** → `/home`. Draft cleared after success.
Wrong QR (a mat label, a URL) → red "Not an enrollment code — ask your admin for the QR".

## Cutter
Home = cutting queue (open; blocked/dimmed cards for batches another cutter has in progress).
Batch → **Start cutting ▶** (exclusive) → same screen shows PIECES COMPLETED input (prefilled with quantity; short count
asks to confirm) → **Complete → send for assignment** → Alert "sent to admin for stitching assignment" → back to queue.

U3: while the cutter holds the claim, **Give back this batch** (ghost button under the stepper, confirm Alert) returns it
to the cutting queue (`POST /worker/batches/:id/release`).

## My work (U3, home)
Card at the top of every home queue: "MY WORK · mats stitched" (or pieces cut / mats packed), **today** and **this week**
(from Monday), stitchers "n came back for rework this week" + "n waiting for you", packers "n sent to rework this week".
`GET /worker/me/summary`, re-read live (RT1) and on pull-to-refresh (once a minute as a fallback). Counts only, never ₹ (D40).

The whole card is a button ("see month" + arrow at the top right) → work history.

## Work history (M1, `app/history.tsx`)
Opened by tapping the My work card. Header: back arrow + "My work". The worker's own counts for one month — the same
numbers the admin sees for that worker and those days (D42); counts only, never ₹ (D40).
- **Month row**: previous (arrow button) · "November 2026" · next (arrow button). Next is off on the current month,
  previous is off at `first_month` (the month of the worker's first output). Month and weekday names come from
  `strings.history` in both languages (no `Intl` — Hermes).
- **Month total**, big, with the station's unit (pieces cut / mats stitched / mats packed) and "N days worked".
- **One row per worked day**, newest first: weekday + date ("Mon 3") left, count right (tabular digits). Today's row
  is marked "today" (by the phone's own date). Days without output are not listed.
- **States**: skeleton while loading; "No work recorded this month"; error → red banner with Retry; offline → the
  yellow offline banner and whatever is cached.
- `GET /worker/me/history?month=`. TanStack key `["my-history", month]` (`"current"` for the current month, which the
  server picks): the current month re-reads live (RT1; once a minute as a fallback) and on pull-to-refresh; a past month is fetched once and
  kept for the session (it only changes on an admin undo — pull to refresh gets that).

## Stitcher
Home shows **only batches assigned to me** (server filters). Card: `📌 Your share: 3 / 8 · with Surya, Mahesh` (or
`📌 Assigned to you` when uncapped), `👤 names` currently working, `▶ You're in — tap to continue` once joined.
Batch → **Join batch ▶** → card becomes `YOUR SHARE 3 / 8 · BATCH 5 / 10` → **Open scanner ▶**.

## Packer
Home = packing queue (open unless assigned). Join → `PACKED n / m` → **Open scanner ▶**. (Slice B adds the Pack ✓ / Rework ✗ step.)

## Scanner (`scan/[batchId]`) — the rules
1. `lock` ref: first line `if (lock.current) return; lock.current = true;` — never toggle `onBarcodeScanned` (camera restarts → black preview).
2. Local validation before any network:
   - not `^B-\d{4}-\d{3}-\d{3}$` → red "Not an RPS unit label"
   - not prefixed by this batch's code → red "Wrong batch — this mat is from B-2026-00X" (stitchers; U3: packers
     peek first and compare `batch_id`, because a reused stitched spare keeps its old code)
   - spare mat (409 `spare` / peek reason `spare`) → red "Spare stock — keep it aside"
3. `POST /worker/units/scan` → flash:
   - green `✓ B-2026-005-003` (counted)
   - amber "Already scanned" + code
   - **blue** "Your share is complete ✓ · 4 / 4 mats — leave the rest for your co-workers" (`quota_reached`)
   - red `✗ <server message>` (wrong phase, not joined, unknown code…)
4. Flash auto-clears and unlocks after ~1.0–1.4 s (`flashAndUnlock`).
5. Progress pill: `3/8 yours · 5/10 batch` (with quota) or `5 / 10 stitched|packed`.
6. `phase_completed` / `batch_completed` → done screen: stitcher "Stitching complete — batch sent to packing"; packer
   "<batch> complete — all N mats packed and sent to the stockyard". Batch code is frozen in state at mount because the
   batch leaves the queue when the phase advances.
   "Back to my queue" (and the back gesture on the done screen) returns to the queue screen that is already open
   (`router.dismissTo("/home")`) — never `replace`, which left the finished batch's screen underneath ("batch not
   found" on the next back). The rework "fixed" screen does the same.
7. Torch toggle in the top bar. Back returns to the batch screen; progress is server-side, so leaving mid-way loses nothing.

## Packer queue — mats out for rework
A mat sent to rework stays in its batch, so the batch stays in the packer's queue until the mat is fixed and packed (or
written off). To stop "3 / 4 packed" reading as work left: the card and the batch screen add "1 in rework · 0 left to
pack" (`rework_open`; left = total − packed − written off − in rework). When nothing is left but rework, the card is
dimmed, gets a "Waiting for rework" chip and sorts to the bottom of the queue (`features/batches/packing.ts`; phone
side only, the server order is unchanged). It returns to normal by itself when the mat comes back (live, RT1).

## Known UX edges
- A co-worker's scan finishing the phase while you're still in the scanner → your next scan gets a red "not at your station's phase". Acceptable; could be softened by checking `wrong_phase` and showing "Batch moved on".
- ~~Progress pill lags for other workers' scans~~ — follows them live since RT1 (within about a second; 15 s if the live line is down).
