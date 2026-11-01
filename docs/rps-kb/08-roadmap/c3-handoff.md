# C3 (Cutter materials) — hand-off prompt (Nov 2026)

Status: **planned, not started.** Paste the prompt below into a new agent session to start C3.
U3 is done and merged to master locally (merge commit `27985a1`, **not pushed yet**).

```text
Start slice C3 (Cutter materials) on RPS. Read AGENTS.md first, then docs/rps-kb/README.md,
docs/rps-kb/08-roadmap/NEXT-STEPS.md and docs/rps-kb/02-domain/materials.md.

STATE
- U3 is merged to master (27985a1, local only — ask before pushing). Decisions so far end at D39;
  migrations at 019. R1 (Reports v2) is built too (its NEXT-STEPS row is ticked on this branch).
- Work on branch agent/slice-c3 (created from master; it only adds this hand-off + the R1 tick).
  Never commit on master. No Claude co-author / attribution lines in commits or PRs.
- C3 scope (NEXT-STEPS): "You'll need …" panel for the cutter, roll QR scan at cutting start, lot QR labels.

WHAT ALREADY EXISTS (build on it, don't duplicate)
- GET /worker/batches/:id/materials-needed (cutter token only, internal/materials/plan.go + routes.go)
  → MaterialsNeeded in @rps/shared: per type need, source, suggested lots {lot_code, color, width, qty},
  shortfall, notes; for the REMAINING mats (quantity − cut_qty). Same planner as the engine
  (materials.BuildPlan), so the preview equals what a cut draws. The phone does NOT call it yet.
- batches.roll_id = the chosen lot (material_lots); the roll covers that lot's type; other types FIFO.
  Kept the name roll_id on purpose (mobile JSON); materials.md says "rename with C3 if wanted".
- Consumption happens at cutting-complete (consumeForCutting) and never blocks the cutter (shortfall rows).
- material_lots.lot_code is UNIQUE. Lot page: admin /stock/lots/[id]; lots list /materials/lots.
- Admin already makes QR/label PDFs: features/batches/label-pdf.ts (jspdf + qrcode + jsbarcode, A4 3×8).
- Mobile: cutting screen apps/mobile/app/batch/[id].tsx (Start cutting → stepper → Report cut; U3 added
  "Give back this batch"); scanner rules in AGENTS.md + 05-mobile/screens-and-flows.md; a scanner screen
  exists for units (app/scan/[batchId].tsx) and one for enrollment (app/enroll-scan.tsx).
- Codes: UNIT_CODE_RE and ENROLL_PREFIX ("RPS-ENROLL:") live in packages/shared/src/constants.ts.

DEFAULTS TO CONFIRM WITH THE OWNER FIRST (ask, then propose the final plan before coding)
1. Roll scan at cutting start is OPTIONAL: after "Start cutting" the cutter is asked to scan the roll they
   are cutting from, with "Skip" (then FIFO as today). Scanning sets the batch's roll for consumption.
2. Lot QR content = "RPS-LOT:<lot_code>" (prefix constant in @rps/shared, like ENROLL_PREFIX).
3. A scanned roll of the wrong material (its type isn't the car's sheet type = product line code) is refused;
   an empty / inactive lot is refused; a roll different from the one the admin picked replaces it after a
   confirm ("Admin picked R-014 — use R-020 instead?").
4. The "You'll need" panel shows quantities and which rolls/lots to take, and a shortfall as a warning
   ("short by 2 m — tell the supervisor"); it never blocks cutting. No ₹ for workers.
5. Lot labels print from the lot page (one lot, N copies) and right after Receive (offer to print); same A4 sheet
   layout as unit labels unless the owner gives the label size.
6. Keep the column name batches.roll_id (no rename).

PLAN (one commit per step, commit style "[C3] ...")
1. Shared: LOT_QR_PREFIX + parseLotQr(text) → lot_code | null; types for the roll-scan request/response.
2. Backend: POST /worker/batches/:id/roll {lot_code} — cutter holding the claim (cutting/in_progress, their
   open log), validate lot (exists, active, qty_remaining > 0, type = car's sheet type), set batches.roll_id,
   return the refreshed MaterialsNeeded. Write an `edited` batch event {fields:["roll_id"], before, after,
   by:"cutter"} + audit (actor = worker). Errors: 404 lot_not_found, 409 wrong_material / lot_empty /
   lot_inactive, 403 not_yours. Go tests with the U3 fixture style (internal/batch/u3_fixture_test.go).
   Check: does a mid-claim roll change interact with consumeForCutting (it reads roll_id at completion —
   it should just work; pin it with a test).
3. Mobile "You'll need" panel on the cutting screen (while cutting/in_progress and the claim is mine; also a
   compact version before Start): features/materials api+hook for materials-needed, per type need + unit,
   suggested lots (code · colour · width · qty), shortfall warning, notes. Strings in lib/strings.ts, theme
   tokens only, ≥48 px targets.
4. Mobile roll scan: after Start cutting → "Scan the roll" screen (or reuse a generic scanner component),
   following ALL scanner rules (lock ref first line, stable onBarcodeScanned, mount camera only when focused,
   unmount before navigating, onMountError → retry banner, feedback via lib/feedback.ts). Skip button. Also a
   "Change roll" entry on the cutting screen. Local check: not RPS-LOT → "Not a roll label".
5. Admin lot QR labels: features/materials/lot-label-pdf.ts (QR of RPS-LOT:<code> + lot code + type/variant +
   colour), "Print labels" on the lot page (copies input) and an offer after Receive. Batch page / lot page
   show which roll the cutter scanned (event).
6. Docs: API reference, materials.md (C3 section), 05-mobile/screens-and-flows.md, 04-admin-web/screens.md,
   labels-and-printing.md, error-catalog, decisions D40+, NEXT-STEPS tick C3 + Postman "C3" folder
   (self-contained like "Workflow corrections (U3b)": create car/lot/cutter, then the roll endpoint guards).

HOW TO VERIFY (lessons from the U3 sessions)
- Tests/Postman only on rps_test: scripts/test-db.sh, TEST_DATABASE_URL=...rps_test. Never touch rps.
- Second backend: cd apps/backend && DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server;
  admin: cd apps/admin-web && NEXT_PUBLIC_API_URL=http://localhost:8082/api/v1 pnpm dev --port 3000.
- Newman: cd apps/backend && npx --no-install newman run RPS.postman_collection.json -e RPS-test.postman_environment.json --folder Auth --folder "<folder>".
  A FULL run has 28 known failures that also fail on master (Health calls :8080; Rework Flow needs
  postman/fixtures/fault.jpg relative to the cwd) — compare against master before calling anything a regression.
- Edit the Postman JSON with json.load + json.dumps(indent=2, ensure_ascii=True) and NO trailing newline
  (that round-trips the file byte-for-byte; check `git diff --stat` shows insertions only). Numeric
  placeholders ({{carId}}) must be unquoted in raw JSON bodies.
- admin-web has noUncheckedIndexedAccess on; there's no web test runner.
- Browser checks (Claude in Chrome): the extension's simulated mouse clicks do NOT open Radix triggers
  (Dialog/AlertDialog/Select/Popover — even the old New batch button), but the page is fine: open them with a
  page-script click (element.click()), use the keyboard (focus + Enter) for Selects, and screenshot to check.
  Dev login fields show placeholders, not values; fill them (owner@ambika.local / dev seed password).
  A first click on a not-yet-compiled route can look dead; wait and retry.
- The phone app can't be checked in the browser; say so, and keep mobile logic thin + typed.
- The scratchpad is wiped when a session restarts: re-create servers/files rather than assuming they exist.
- Your dev DB `rps` may lag the migrations; tell the owner the migrate command instead of running it.
- Run the full AGENTS.md verify list + scripts/review.sh master before saying done; show output in a fenced
  block separate from summaries (the owner once pasted a summary into the shell).

Start by asking me the six defaults, then show the final plan and wait for my go-ahead.
```
