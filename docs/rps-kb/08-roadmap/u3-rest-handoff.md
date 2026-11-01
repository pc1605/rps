# U3 (rest) — hand-off prompt (Nov 2026)

Status: **planned, not started.** Paste the prompt below into a new agent session to continue U3.
The stitching-assignment part of U3 is done (see `stitching-assignment-ux.md`, decisions D31–D33).

```text
Continue U3 (the rest of it) on RPS. Read AGENTS.md first, then docs/rps-kb/README.md and
docs/rps-kb/08-roadmap/NEXT-STEPS.md.

STATE
- The stitching-assignment part of U3 is done, merged to master (b77b037) and pushed to origin.
  Decisions D31–D33 are in docs/rps-kb/07-decisions/decision-log.md.
- Work on branch agent/slice-u3 (it is level with master). Never commit on master.
- No Claude co-author / attribution lines in commits or PRs.

OWNER ANSWERS (already given, don't re-ask)
- Cancelling a batch after cutting: cut AND stitched mats become SPARE STOCK (not written off).
  Packed mats can't be cancelled (cancel is allowed until the first mat is packed).
- Spares are reused by offering them on "New batch" for the same car item.
- Owner and supervisors may cancel.
- Undo scan: supervisor/owner only, from the admin (workers can't undo).
- Also in scope: release a stuck cutting claim (admin + the cutter on the phone), and a "My work"
  card on the phone home screen (today / this week mats, rework returned; no ₹ yet, that's Slice D).

DEFAULTS TO CONFIRM WITH THE OWNER FIRST (ask, then propose the final plan before coding)
1. Mats in open rework when a batch is cancelled are written off, not kept as spares.
2. Undo scan is refused once the next stage has started (e.g. can't undo a stitch after packing began).
3. Spares only match the exact same car item (model + product line).

PLAN (one commit per step, commit style "[U3] ...")
1. Edit before cutting: PATCH /batches/:id {car_model_id, quantity, roll_id, notes}, only while
   current_phase=cutting and status=pending (no open cutting claim). Quantity change adds/removes
   batch_units. "edited" batch event (before/after) + audit. Admin: Edit button on the batch page.
2. Migration 017: add 'spare' to unit_status. Cancel: POST /batches/:id/cancel {reason, note?}.
   Stitched mats → spare (keep unit_code); cut-unstitched → spare; never-cut units deleted;
   rework-open → per default 1. Close open phase_logs, clear assignments, status=cancelled,
   "cancelled" event + audit. Materials already consumed stay consumed. Admin: Cancel button +
   AlertDialog that shows the outcome ("4 → spare, 2 never cut → removed").
3. Spares: GET /spares per car item (stitched / unstitched counts); Spares page under Stock with
   Write off.
4. Reuse on New batch: "N spare mats (k stitched) — use them". Used spares move into the new batch
   already cut (cutter cuts fewer → engine consumes less). Unstitched spares get a new unit_code
   for the new batch; stitched spares keep theirs and count as stitched. If spares cover the whole
   batch, skip cutting. RULE CHANGE: stitching quotas must total the mats still to stitch (exclude
   pre-stitched spares); the original stitcher keeps credit without being assigned — check
   SetAssignments' "worker with stitched mats can't be removed" guard, ScanUnit quota gate and
   stitching-completion still hold.
5. Release claim: POST /batches/:id/release-claim (admin) and POST /worker/batches/:id/release
   (cutter, before Complete). Close the open cutting phase_log, batch back to cutting/pending,
   "claim_released" event + audit. Admin: Release on the open timeline entry; mobile: button on the
   cutting screen.
6. Undo scan: POST /units/:code/undo-scan {reason}. Undoes the unit's latest stitch or pack scan; if
   that scan advanced the batch (last stitch → packing, last pack → completed), move it back only if
   nothing happened in the next stage; refuse while the unit is in rework. Event + audit + reason.
   Admin: "Undo last scan" on the unit page and the batch page unit cards.
7. My work: GET /worker/me/summary (today, this week by station, rework returned). Mobile card on
   home; strings in lib/strings.ts; theme tokens only.
8. Docs (API reference, screens, work-model, decisions D34+, NEXT-STEPS tick U3) + Postman "U3b" folder.

HOW TO VERIFY (lessons from the last session)
- Tests/Postman only on rps_test: scripts/test-db.sh, TEST_DATABASE_URL=...rps_test. Never touch rps.
- Second backend: cd apps/backend && DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server;
  admin: NEXT_PUBLIC_API_URL=http://localhost:8082/api/v1 pnpm dev --port 3000.
- Newman works: npx --no-install newman run RPS.postman_collection.json -e RPS-test.postman_environment.json --folder Auth --folder "<folder>".
- Edit the Postman JSON with json.dumps(indent=2, ensure_ascii=True), or the whole file reformats.
- admin-web has noUncheckedIndexedAccess on; there's no web test runner (check pure logic with a
  scratch `node --experimental-strip-types` script).
- In the browser, the dev login fields show placeholders, not values; fill them. A first click on
  a not-yet-compiled route can look like a dead link; wait and retry before calling it a bug.
- Run the full AGENTS.md verify list + scripts/review.sh master before saying done; show output in
  a fenced block separate from summaries (the owner once pasted a summary into the shell).

Start by asking me the three defaults, then show the final plan and wait for my go-ahead.
```
