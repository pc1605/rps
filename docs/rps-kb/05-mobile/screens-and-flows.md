# Worker Flows (as built)

## Enrollment (in front of the admin — D44)
Login → **📷 Scan enrollment code** → camera → the QR on the admin's screen (`RPS-ENROLL:` + 6 digits, valid once,
10 minutes) → back; the screen says **Code scanned ✓** and never shows the code → PIN (4 digits) →
**Set up this phone →** → `/home`. Draft cleared after success.
Camera not working → **Enter code by hand** → a field that shows dots; the admin types the digits from their screen.
Wrong QR (a mat label, a URL, an old badge QR) → red "Not an enrollment code — ask your admin for the QR".
Wrong / used / expired code or wrong PIN → "Wrong code or PIN" (scan again; the admin makes a new code if needed).
**One phone per worker**: when the worker signs in on another phone, this phone's next request is refused
(`signed_in_elsewhere`); it signs out, drops to the login screen and says why (`components/SessionGuard.tsx`). The
same for any other refused token (deactivated, 30-day token ran out): "This phone is signed out". No network, a timeout
or a server error never sign out — opened offline, the app keeps the token and loads the profile when back online
(`lib/session.ts`). Every sign-out empties the query cache, so the next worker on the phone never sees the last one's data.

## Cutter
Home = the batches the admin assigned to this cutter (D48 — no open cutting queue; each card says "📌 Assigned to
you"). A notification arrives when a batch is assigned (D47).
Batch → **Start cutting ▶** (exclusive) → same screen shows PIECES COMPLETED input (prefilled with quantity; short count
asks to confirm) → **Complete → send for assignment** → Alert "sent to admin for stitching assignment" → back to queue.

U3: while the cutter holds the claim, **Give back this batch** (ghost button under the stepper) opens the give-back screen
(`app/batch/give-back/[id].tsx`): "Why are you giving it back?" — five reason tiles (Machine problem · Material problem ·
Too much work · Shift over · Other), a note (needed for Other), footer **Give back**. It returns the batch to the admin,
who assigns a cutter again (`POST /worker/batches/:id/release {reason, note}`; D48) → "Done ✓ … is back with the admin."
→ home.

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

## Notifications (N1, D47 — `lib/notifications.tsx`)
- After sign-in the app asks for notification permission once (Android 13+), creates the channel "Work for you"
  (`work`, high importance, sound) and sends its Firebase token + the current language to
  `PUT /worker/me/push-token`; again when the language changes or Firebase renews the token. Sign-out sends `DELETE`.
- The server notifies: a batch newly assigned to the worker while it is at their station (also by a hand-over, if
  they were not on it yet); a rework mat
  sent to the stitcher (straight after flagging, or when the owner decides "back to stitcher"). Titles in the phone's
  language, body = codes + car. Shown with sound also while the app is open.
- Tap → `/batch/[id]` or `/rework/[id]` (also when the tap started the app).
- No permission, no Firebase file in the build, or no network → the app works as before, without notifications.
- Needs `apps/mobile/google-services.json` (Firebase console, not committed) **in the build** — a native rebuild.

## Known UX edges
- A co-worker's scan finishing the phase while you're still in the scanner → your next scan gets a red "not at your station's phase". Acceptable; could be softened by checking `wrong_phase` and showing "Batch moved on".
- ~~Progress pill lags for other workers' scans~~ — follows them live since RT1 (within about a second; 15 s if the live line is down).
