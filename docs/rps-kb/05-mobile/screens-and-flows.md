# Worker Flows (as built)

## Enrollment (once per phone)
Login → **📷 Scan enrollment code** → camera → admin's QR (`RPS-ENROLL:<badge>`) → back with code filled (accent border)
→ or type the code → PIN (4 digits) → **Set up this phone →** → `/home`. Draft cleared after success.
Wrong QR (a mat label, a URL) → red "Not an enrollment code — ask your admin for the QR".

## Cutter
Home = cutting queue (open; blocked/dimmed cards for batches another cutter has in progress).
Batch → **Start cutting ▶** (exclusive) → same screen shows PIECES COMPLETED input (prefilled with quantity; short count
asks to confirm) → **Complete → send for assignment** → Alert "sent to admin for stitching assignment" → back to queue.

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
   - not prefixed by this batch's code → red "Wrong batch — this mat is from B-2026-00X"
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
7. Torch toggle in the top bar. Back returns to the batch screen; progress is server-side, so leaving mid-way loses nothing.

## Known UX edges
- A co-worker's scan finishing the phase while you're still in the scanner → your next scan gets a red "not at your station's phase". Acceptable; could be softened by checking `wrong_phase` and showing "Batch moved on".
- Progress pill lags for other workers' scans until you scan or re-enter (polling model).
