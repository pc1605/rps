# Testing

## Test database (never `rps`)
DB tests, Postman runs and test seeds use the isolated **`rps_test`** database — never the developer's `rps`.
```bash
scripts/test-db.sh                  # drop (force) → create rps_test → all migrations → seed-dev.sh rps_test
export TEST_DATABASE_URL='postgres://rps_dev:rps_dev_password@localhost:5433/rps_test?sslmode=disable'
cd apps/backend && go test -race ./...
```
- Every DB test gets its pool from `testutil.DB(t)` (`internal/testutil/db.go`): reads `TEST_DATABASE_URL` only,
  **skips** when it's unset or unreachable, **fails** if it points at a database named `rps`, serialises DB tests
  across packages with an advisory lock, and **fails the test if it leaves rows behind** (row counts of all domain
  tables before vs after; `audit_log` and `batch_code_counters` excluded).
- Tests delete what they create in FK order (movements/plan → batches (units, logs cascade) → cars → groups …).
- The lefthook **pre-push** `go-test` sets `TEST_DATABASE_URL` to rps_test; without rps_test the DB tests skip.
- Rows left in a dev DB by test runs from before this isolation: `scripts/cleanup-test-junk.sql` (dry run by
  default; `psql "$DATABASE_URL" -v commit=1 -f scripts/cleanup-test-junk.sql` to apply). Run it yourself — agents don't.

## JS tests (phone, admin, shared)
`pnpm test` (repo root) runs Node's own test runner on the `*.test.ts` files in `packages/shared/src`,
`apps/mobile/{lib,features}` and `apps/admin-web/{lib,features}` — no extra dependency (Node ≥ 22 runs TypeScript).
They cover the pure logic: live reconnect back-off, sign-out decisions, push-token sending, scanner progress / wrong
batch, assign-form key, the admin's token refresh, which queries a live note re-reads. A test imports with the `.ts`
extension and starts with `/// <reference types="node" />` (TypeScript 6 includes no `@types` by default).

## Phone checks for the review fixes (Nov 2026) — run by the owner
1. [ ] **Opened offline stays signed in.** Close the app, Wi-Fi off, open it → home with the offline banner, not the
   login screen. Wi-Fi on → name and queue load.
2. [ ] **Deactivated → login screen.** Admin deactivates the worker → the phone's next refresh goes to login with
   "This phone is signed out". Reactivate + set up again.
3. [ ] **Notifications after "signed in elsewhere".** Set A up on phone 2, then on phone 1 again (without restarting
   phone 1's app) → assign A a batch → phone 1 is notified.
4. [ ] **Next worker sees nothing of the last.** Sign A out, sign B in on the same phone → home card, queue and work
   history (also an earlier month) are B's.
5. [ ] **Hand-over while scanning.** A in the scanner; admin hands A's batch over to B → A's next scan: red "This batch
   is assigned to other workers"; "Wrong batch" still shows for a mat of another batch.
6. [ ] **Share pill follows the admin.** A in the scanner with 2/4; admin changes A's target to 5 → pill shows 2/5.
7. [ ] **Admin assign panel keeps typed numbers** while a stitcher scans on that batch.

## Automated Smoke Tests
```bash
# Real DB query smoke test (validates SELECT/Scan bindings, migrations, column aliases) — on rps_test
cd apps/backend && TEST_DATABASE_URL=… go test -v ./internal/batch -run TestReadQueriesSmoke
```

## Postman collection (`apps/backend/RPS.postman_collection.json`)
**Run only against a second backend on rps_test:** `cd apps/backend && DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server`,
then select the **`RPS test`** environment (`apps/backend/RPS-test.postman_environment.json`, `baseUrl`
`http://localhost:8082/api/v1` — environment values override the collection's `baseUrl`). Never against :8080 / `rps`.

**Full run — from the repo root** (the Rework Flow photo `postman/fixtures/fault.jpg` is resolved against the
working directory, so a run from `apps/backend` fails 24 assertions):
```bash
npx --no-install newman run apps/backend/RPS.postman_collection.json -e apps/backend/RPS-test.postman_environment.json
```
Expected: 0 failed requests, 0 failed assertions (Nov 2026: 331 requests, 560 assertions). It can be re-run on the
same rps_test without resetting it. Add `--folder "<name>"` (repeatable) to run part of it. In the Postman app, set
Settings → General → Working directory to the repo root for the photo upload. Scripts read `baseUrl` with
`pm.variables.get` (environment wins), never `pm.collectionVariables.get` (that's the :8080 default); `Health` derives
the server root from `baseUrl`.

Login limit (E1): one run makes 1 failed admin login and 3 failed worker logins; the limit is 10 per 15 minutes per
route. From the 4th run within 15 minutes the logins answer 429 and the run fails — restart the test backend (the
counters are in memory) or start it with `LOGIN_MAX_FAILURES=1000`. The `Auth` folder also checks the refresh cookie:
newman keeps cookies between requests, so `Refresh` works with no body.

Variables: `baseUrl` (localhost:8080/api/v1), `accessToken`, `workerToken` (cutter), `stitcherToken`, `stitcher2Token`,
`packerToken`, `enrollCode` (set by each login's pre-request script), `batchId`, `workerBatchId`, `scanBatchId/Code`, `stockRollId`, `reportFrom/To`.
Convention: tests read `const responseData = pm.response.json().data`, assert `code` fields not messages (except worker-login
`invalid code or pin`, manual-complete `.include('scanned')`, admin-forbidden `worker token required`).

Folders and run order:
1. **Auth** → Login (saves admin tokens)
2. **Workers (Admin)** → Create Worker (cutter Ramesh, PIN 1234) · list · validations
3. **Worker Auth** → Worker Login (pre-request: admin makes the one-time code; saves `workerToken`) · wrong PIN · unknown code · code works only once · second phone signs the first out · me · admin route forbidden
4. **Reference**, **Batches** (create/list/get/validation), **Stock**
5. **Worker Phase Flow** — cutting only now: queue · start · start-again 409 · Cutter Complete · complete-again 409 · admin-token forbidden
6. **Multi-Worker Scanning** — self-contained (creates qty-4 batch, Stitcher A/B, packer; cutter start/complete; both stitchers join; split scans; idempotent re-scan; manual complete 400; last scan `phase_completed`; stitcher-after-move 409; packer joins via pre-request and packs all → `batch_completed`).
   Since Slice A the admin assigns the stitchers with quotas after cutting (`PUT /batches/{{scanBatchId}}/assignments`) before they join.
7. **Reports** — default range, dynamic 30-day with echo check, invalid range 400, worker 403, sort assertion.
8. **Materials (C1c)** — self-contained (logs in, builds a cutter token): types, variants, receive, adjust/waste/return,
   lot PATCH, movements pagination, groups, recipes, car group + overrides, resolve dry run, batch → cutter
   materials-needed → cut → batch materials; main 4xx; restores the car's group at the end.
   Full-run command with `--folder "Materials (C1c)"`.
9. **Entity pages (U1)** — worker detail/summary/history, busy-deactivate 409, throwaway packer: edit, reset PIN,
   login with it, deactivate → its token 401, reactivate; unit journey, car overview, lot detail; main 4xx. Same command with `--folder "Entity pages (U1)"`.
10. **Lists & search (U2)** — read-only: paging, views, sort, filters, `q` (no wildcard), 400s; search exact batch /
    mat, worker hit, 1-char empty; `stats.working`. Self-contained (logs in).
11. **Short-Cut Resolution**, **Assignments & Quotas**, **Rework Flow**, **Reports v2 (R1)**, **Stitching assignment (U3)**,
    **Workflow corrections (U3b)** — run inside the full run (U3b alone: see below).
Folders that need earlier ones in the same run: **Batches** needs `--folder "Auth" --folder "Cars & Reference"`
before it (each Newman run starts with empty variables).

Use **Collection Runner → Run folder** to avoid ordering mistakes. Re-runs create "PM …" workers; clear with the reset SQL.

## Full manual test (the "does the factory work" script)
Cast: cutter (Ramesh), two stitchers (Surya, Mahesh), packer (Raju) — 2–3 phones/emulator, PIN 1234.
1. Admin creates batch qty 10 → appears under Batches → **Needs a cutter**; the cutter phone shows nothing. Assign →
   Ramesh → batch moves to Cutting and appears on Ramesh's phone (D48).
2. Cutter: Start → Complete (10) → batch moves to **Ready to stitch**; both stitcher phones show nothing.
3. Admin: batch detail → check Surya 8, Mahesh 2 → `10/10 ✓` → **Assign & print labels** → taffeta PDF; batch under Stitching.
4. Surya's phone: `📌 Your share: 0/8`; Mahesh: `0/2`. Both Join.
5. Surya scans 8 → 9th → blue "Your share is complete". Mahesh re-scans one → amber. Mahesh scans 2 → "Stitching complete — sent to packing".
6. Admin: batch under Packing → **Print stickers** → PDF; button → Reprint. Units grid shows 🧵 names; timeline shows stitching ×2 (8 pcs / 2 pcs).
7. Packer: Join → scan all 10 → done screen; Batches → Completed; Stock → Finished +10; Reports credit Surya 8 / Mahesh 2 / Raju 10 / Ramesh 10.
8. Edge checks: kill app mid-scan → reopen → counts intact; scan a mat from another batch → red "Wrong batch"; edit Surya's quota below 8 → 400 toast.

## Real-phone checklist (U3 + P1) — run by the owner, the agent can't drive the phone app
Setup: your dev DB must have migrations up to 019 (`set -a; source .env; set +a; migrate -path apps/backend/migrations -database "$DATABASE_URL" up`),
a dev build of the app pointed at your backend, one cutter, one stitcher and one packer phone (PIN 1234). Tick each:
1. [ ] **Cutter — Give back this batch.** Cutter starts a batch → batch screen shows "Give back this batch" under the
   stepper → tap → "Why are you giving it back?" → the footer says "Choose a reason" until a tile is picked; **Other**
   needs a note → **Give back** → "Done ✓ … is back with the admin." → home; the batch leaves the cutter's queue and waits
   in the admin's **Needs a cutter** (D48). The batch page's Cutter card says "<cutter> gave it back · <time> — <reason>:
   <note>" (the timeline no longer shows the claim).
2. [ ] **My work card** (home, top) on each phone: title "My work · pieces cut / mats stitched / mats packed"; *today* and
   *this week* match what that worker did (admin Reports → Workers for the same days). Stitcher: after a mat of theirs is sent
   to rework, "1 came back for rework this week" and "1 waiting for you"; packer: "1 sent to rework this week" after flagging one.
3. [ ] **Scanning a spare.** Stitcher joins a batch, scans 1 mat and keeps the scanner open. Admin cancels that batch
   (Cancel batch → the dialog says the stitcher "is stitching it now" → reason → Cancel). Stitcher scans another mat of it →
   red "✗ Spare stock — keep it aside" (no count change). (A mat of a *different* batch says "Wrong batch" first — that's right.)
4. [ ] **Packer scans a reused stitched spare.** Cancel a batch with at least 1 stitched mat → New batch of the same item
   reusing that stitched spare → stitch the rest, so the batch is at packing. Packer joins, scans the reused mat (its label
   still shows the OLD batch code) → Pack / Needs rework sheet appears (not "Wrong batch") → Pack → count goes up.
5. [ ] **Packer scans a mat of another batch** (a normal one, not reused) → red "✗ Wrong batch — this mat is from B-…".
6. [ ] **Texts after the strings.ts move (P1).** Walk login, home, batch screen, scanner, rework (send / fix): every text,
   button and banner reads as before (nothing blank, no "undefined"); the cutter's short-count alert still names both numbers.

## Hindi on a real phone (H1) — run by the owner, the agent can't drive the phone app
Setup: a dev build pointed at your backend (JS only changed — reload the app; no native rebuild), one cutter, one
stitcher and one packer phone. Wording list to read alongside: `docs/rps-kb/05-mobile/hindi-texts.md`. Tick each:
1. [ ] **Fresh install starts in Hindi.** Clear the app's data (or install fresh) → login screen is in Hindi, with
   "English | हिन्दी" at the top right and हिन्दी highlighted.
2. [ ] **Switch on login.** Tap English → the whole screen changes at once (title, button, labels); tap हिन्दी → back.
   Type a wrong PIN → red "कोड या PIN गलत है"; switch to English while it shows → it reads "Wrong code or PIN".
3. [ ] **Switch on home.** After login the picker sits next to "लॉग आउट". Switch both ways: header ("कटर लिस्ट" …),
   My work card, batch cards (phase chip कटिंग / सिलाई / पैकिंग, "आपको दिया गया") and the rework section all change.
4. [ ] **Restart keeps it.** Pick English → close the app fully → open → still English. Pick हिन्दी → same.
5. [ ] **Sign out keeps it.** In Hindi tap लॉग आउट → login screen is in Hindi. Same for English.
6. [ ] **Every screen in Hindi** — nothing left in English except codes, names, car / product line names, digits and
   "RPS": login, enroll scan (hint + "not an enrollment code" flash), home + My work, batch screen (cutter: stepper,
   short-count alert with both numbers, "यह बैच वापस करें" dialog; stitcher / packer: जुड़ें → स्कैनर खोलें), scanner
   (progress pill, hint, ✓ flash, done screen), packer inspect sheet (✓ पैक करें / ✗ रीवर्क चाहिए / कैंसल), rework send
   1/2 (photo count) and 2/2 (reason tiles, note), rework detail, rework fix (target pill, "ठीक हो गया ✓").
7. [ ] **Font.** Hindi letters, the Latin names / codes inside a Hindi line and the digits look like one font (no
   boxes, no mixed weights); batch and unit codes are still the mono font. No matra is cut off at the top or bottom of
   any line — look hardest at the big ones: home title, "आपका हिस्सा पूरा हुआ ✓" flash, the scanner progress pill.
8. [ ] **Largest font size.** Android Settings → Display → Font size → largest. Walk the same screens in Hindi:
   every button text is fully inside its button (it may wrap to two lines), buttons are still easy to hit, no number
   or code is cut ("…"), the home header still shows both the picker and लॉग आउट (they may stack).
9. [ ] **Flashes in Hindi.** Stitcher scans a mat of another batch → "✗ गलत बैच — यह मैट B-… का है". Scan a spare
   (see U3 item 3) → "✗ स्पेयर माल — अलग रखें". Stitcher with a share scans past it → blue "आपका हिस्सा पूरा हुआ ✓".
10. [ ] **Error while offline.** Turn off Wi-Fi/data: yellow banner "इंटरनेट नहीं है — जुड़ने पर अपडेट होगा"; scan →
    "✗ इंटरनेट नहीं है — जुड़ने पर स्कैन करें"; cutter taps कटिंग शुरू करें → alert "यह नहीं हो पाया" with a Hindi line.
11. [ ] **English is unchanged.** Switch to English and glance over the same screens: texts read as before H1, the
    font is IBM Plex Sans again, spacing as before.
12. [ ] **Back arrow.** One and the same arrow (←, drawn) in both languages, level with its text, never a box or a
    thin "‹": header back on the batch / rework screens (amber), the scanner and rework-fix top bar (white, before the
    code), rework send 1/2, enroll scan "Cancel", and the "Back" button on a "Camera needed" screen. Check light and dark.
13. [ ] **TalkBack (optional).** With TalkBack on in Hindi, a scan announces "B-… स्कैन हुआ" and buttons read in Hindi.

## Work history on a real phone (M1) — run by the owner, the agent can't drive the phone app
Setup: a dev build pointed at your backend (JS only changed — reload the app; restart the backend so it has the new
endpoint; no migration). A stitcher phone is enough; a cutter and a packer for item 2. Tick each:
1. [ ] **Open from the card.** Home → the My work card shows "see month" with an arrow at the top right → tap anywhere
   on the card → "My work" screen with a back arrow; back returns to the queue.
2. [ ] **Same numbers as the admin.** Admin → Reports → Workers (or the worker's page) for that worker, from the 1st
   of the month to today: the phone's month total equals the admin total, and each day row equals the admin's day.
   The unit under the total is right per station: pieces cut / mats stitched / mats packed.
3. [ ] **Days.** Newest day on top, "Mon 3" style, today's row marked "today"; days without work are not listed;
   "N days worked" equals the number of rows.
4. [ ] **Previous / next month.** On the current month the next arrow is faded and does nothing. Previous goes back
   month by month and fades at the worker's first month of work. Next comes back to the current month. A month
   without work says "No work recorded this month" with total 0.
5. [ ] **Hindi.** Switch to हिन्दी on home, open the screen: title "मेरा काम", month name ("नवंबर 2026"), weekday
   ("सोम 3"), "आज", "N दिन काम किया", "महीना देखें" on the card — digits stay 0–9. Wording list: `hindi-texts.md` 212–236.
6. [ ] **Largest font size.** Android Settings → Display → Font size → largest, in Hindi: the card's "महीना देखें"
   drops under the title instead of being cut; the month name stays between the two arrows; no count is cut ("…").
7. [ ] **Offline.** Open the current month and one earlier month, turn off Wi-Fi/data: yellow offline banner, both
   months still show. A month never opened shows only the banner. Back online → it loads.
8. [ ] **A scan made now shows within a minute.** Stitch (or pack / complete a cut) with the screen open on the
   current month → today's row and the total go up within a minute, or at once on pull-to-refresh.
9. [ ] **Admin undo lowers it.** Admin → the mat → Undo last scan (stitch) → within a minute the phone's today row
   and total are 1 lower (and the home card too).
10. [ ] **Light and dark.** Both themes: arrows, rows and the faded arrow are readable.

## Live updates (RT1) — admin browser and real phones, run by the owner
Automated: `go test ./internal/live` (hub; and the real stream over a socket: connect, a write sends "changed", reads /
failed writes / `/auth/*` don't, shutdown ends the line). Postman can't hold a stream open, so there is no request for it.
Quick look with curl (test backend): `curl -N -H "Authorization: Bearer $T" http://localhost:8082/api/v1/live` prints
`: connected`, then `data: changed` whenever any write succeeds, and `: ping` every 25 s.
Setup for the checks below: restart the backend (new endpoint); reload the admin; reload the phone app (JS only — no
native rebuild). One admin browser, one stitcher phone, one packer or second stitcher phone. Tick each:
1. [ ] **Admin follows a scan.** Admin on the batch page (units grid). Stitcher scans a mat → the mat turns stitched
   and the count goes up within about a second, without touching the browser. Same on Batches (list) and the sidebar counts.
2. [ ] **Admin pages that never refreshed before.** Reports → Workers open; a scan → that worker's count goes up by
   itself. Workers list open in one browser; create a worker in another → it appears.
3. [ ] **Phone follows the admin.** Stitcher phone on the queue. Admin assigns a batch to that stitcher → the batch
   appears on the phone within about a second (no pull-to-refresh).
4. [ ] **Phone follows a co-worker.** Two stitchers in the same batch, both in the scanner. A scans → B's pill
   ("… · 5/10 batch") goes up within about a second without B scanning.
5. [ ] **My work follows.** Home card and the work history (current month) go up right after the worker's own scan;
   an admin "Undo last scan" lowers them within about a second.
6. [ ] **App in the background.** Put the phone app in the background for a minute, make a change from the admin,
   bring the app back → it shows the change at once.
7. [ ] **Wi-Fi drop.** Turn the phone's Wi-Fi off for 30 s and on again → within about 10 s of being back it is
   live again (repeat check 3). While off, the offline banner shows as before.
8. [ ] **Server restart.** Restart the backend with the admin and a phone open → nothing breaks; within about 10 s
   both are live again (repeat checks 1 and 3).
9. [ ] **Hidden tab.** Open the admin in 8 tabs → every tab still loads (only the visible one holds a line). Switch
   to another tab → it is up to date at once.
10. [ ] **Through ngrok / the hotspot** (however the phones reach the backend): check 3 still works — a proxy that
    buffers the stream would make changes arrive late (they would still arrive within a minute by the fallback).

## Cutter assignment (D48) — real phones, run by the owner
Automated: `go test ./internal/batch -run 'TestCutterAssignment|TestReleaseClaim|TestNotifications'`; Postman "Workflow
corrections (U3b)" (start before assignment 403, two cutters 400, stitcher as cutter 400, cutter load, give back →
Needs a cutter). Setup: dev DB on migration 022, two cutter phones (A and B), the admin in a browser. Tick each:
1. [ ] **Nothing to pick.** Admin creates a batch → it is under **Needs a cutter** (sidebar + dashboard, amber); neither
   cutter phone shows it.
2. [ ] **Assign.** Assign → the panel lists both cutters (least busy first) → pick A → A's phone shows it with "📌 Assigned
   to you" (and a notification, with the Firebase key set); B sees nothing.
3. [ ] **Change.** Batch page → Cutter card → **Change cutter** → B → it moves from A's phone to B's.
4. [ ] **Started.** B starts it → the Cutter card says "B is cutting it now", no change button; the panel says to release
   the claim first.
5. [ ] **Give back.** B gives it back with a reason → back in Needs a cutter, gone from B's phone; the batch page shows
   no short-cut box, and the Cutter card says B gave it back, when and why.
6. [ ] **Short cut.** Assign A, A cuts fewer than planned → Ready to stitch shows the short cut → **Re-cut** → the batch
   is in Needs a cutter (not on A's phone) until the admin assigns someone. **Split** → the remainder is in Needs a cutter.
7. [ ] **Hindi.** A's phone in हिन्दी → give back screen: "आप इसे वापस क्यों कर रहे हैं?", "यह एडमिन के पास वापस जाएगा…".

## Notifications (N1) — real phones, run by the owner
Automated: `go test ./internal/push` (the Firebase request, dead tokens, who gets what in which language),
`go test ./internal/batch -run TestNotifications` (when the server notifies whom), `go test ./internal/worker -run
TestPushToken`; Postman "Worker Auth" (push address saved / refused / removed).
Setup: Firebase key on the backend (`FCM_CREDENTIALS_FILE`), restart it; a new APK built **with**
`apps/mobile/google-services.json`. Two stitcher phones (A and B), the admin in a browser. Tick each:
1. [ ] **Permission.** Fresh install, sign in → Android asks to allow notifications → Allow.
2. [ ] **Assigned, app closed.** Swipe the app away on A, lock the screen. Admin assigns a batch to A → within a few
   seconds a notification with sound: "📌 New batch assigned to you", batch code + car. Tap → the batch opens.
3. [ ] **Hindi.** Switch A to हिन्दी, close it, assign another batch → the title comes in Hindi.
4. [ ] **Helper added.** Admin adds B to the same batch → only B is notified; saving the same assignment again → nobody.
5. [ ] **Hand-over.** Admin hands A's batch over to B → B is notified.
6. [ ] **Rework.** Packer flags a mat A stitched as a stitching fault → A gets "🔧 Rework mat to fix"; tap opens it.
   A cutting fault → nobody until the owner chooses "back to stitcher" → then A.
7. [ ] **App open.** With RPS on screen, an assignment shows the banner too (and the queue updates live).
8. [ ] **Sign-out.** Sign A out, assign a batch to A → no notification on that phone.
9. [ ] **Other phone.** Set A up on a second phone → only the new phone gets A's notifications.
10. [ ] **Said no.** On a phone where notifications were refused, the app works normally.

## Admin browser checks (P1, 2 Nov 2026, rps_test)
Checked in Chrome against the test backend: Spare mats → **Write off** dialog (opens, counts, writes off 1 → list updates),
**Edit** (opens; only shown once nobody holds the batch), **Cancel batch** (warning: cutting "<name> is cutting it now — cuts
not yet reported are lost", stitching "<name> is stitching it now — cancelling takes them off it"), timeline **Release**
(toast, claim gone, warning gone), unit **Undo last scan** (reason required, 1/3 → 0/3), cancelled batch fully reused
("All 3 mats reused in B-…" on the list and the batch page). **A real mouse click was NOT confirmed:** the Claude in Chrome
extension's clicks and key presses delivered no events at all to the page (no pointerdown/mousedown/click on rows or plain
buttons, typing didn't change inputs) in that session, so the dialogs were opened with a page-script `element.click()` and
inputs set via the native value setter. Open each of these once with your own mouse.

## Curl snippets
```bash
API=http://localhost:8080/api/v1; T=<admin token>
curl -s -X PUT $API/batches/$BID/assignments -H "Authorization: Bearer $T" -H "Content-Type: application/json" \
  -d '{"phase":"stitching","assignments":[{"worker_id":"<surya>","target_qty":8},{"worker_id":"<raj>","target_qty":2}]}'
curl -s -X POST $API/worker/units/scan -H "Authorization: Bearer $STITCHER" -H "Content-Type: application/json" -d '{"unit_code":"B-2026-005-001"}'
```

### U3b folder — "Workflow corrections (U3b)"
Self-contained (creates its own car item, cutter and stitcher; run after `Auth`): edit before cutting, cutter
assignment (D48: start before assignment 403, two cutters / a stitcher 400, cutter load; each start is preceded by an
assignment), cutter + admin release (back to Needs a cutter), undo scan, cancel → spare stock, cancelled view, scanning a spare, reuse on New batch, spare write-off,
My work, work history (M1: 200 + shape, bad month 400, future month 400, admin token 401). Full-run command with `--folder Auth --folder "Workflow corrections (U3b)"`.

