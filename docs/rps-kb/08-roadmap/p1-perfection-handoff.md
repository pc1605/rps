# P1 — "make it perfect" pass — hand-off prompt (Nov 2026)

Status: **planned, not started.** Paste the prompt below into a new agent session.
Owner direction (2 Nov 2026): what exists must work with 100% perfection; no over-engineering, no new features the
floor doesn't need. C3 is parked (NEXT-STEPS "Future plan"); R2 / D / "late batch" wait for owner answers.

```text
Do the P1 "make it perfect" pass on RPS. Read AGENTS.md first, then docs/rps-kb/README.md and
docs/rps-kb/08-roadmap/NEXT-STEPS.md.

GOAL
Make what already exists work perfectly. No new features, no new endpoints/tables unless a fix truly needs one,
no refactors for their own sake. If something looks like a feature, stop and ask me.

STATE
- master = fe43586, pushed to origin (U3 complete, D34–D39, migrations up to 019).
- Work on branch agent/polish-p1 (created from master; only adds this hand-off). Never commit on master.
- No Claude co-author / attribution lines in commits or PRs.

THE LIST (one commit per item, commit style "[P1] ...")
1. Postman suite fully green. A full run has 28 failing assertions, on master too:
   - "Health / Healthz" requests http://localhost:8080/healthz (hard-coded; /healthz is at the root, not under
     /api/v1, so {{baseUrl}} doesn't fit). Fix without hard-coding a port (e.g. derive the root from baseUrl in a
     pre-request script, or a rootUrl variable in both environments).
   - "Rework Flow" uploads postman/fixtures/fault.jpg; the file is at the REPO ROOT (postman/fixtures/fault.jpg),
     so a run from apps/backend can't find it, and later steps (e.g. "Multi-Worker Scanning / Packer scans 4")
     fail with it. Make the run work from the documented directory and document the exact command once
     (06-operations/testing.md). Then: full run → 0 failures.
   Purpose: today a real regression hides among known failures; the safety net only works when it's all green.
2. Cancel dialog dead line. apps/admin-web/features/batches/components/cancel-batch-dialog.tsx shows
   "<name> is working on it now — mats not yet reported cut count as never cut" from batch.active_workers, but
   GET /batches/:id (Service.Get, internal/batch/service.go) never fills ActiveWorkers (only the list and the
   worker queue do), so it can never appear. Fix it so the admin is warned when someone holds an open claim /
   log on the batch (fill active_workers in Get the same way list.go does), and make the wording right for
   each phase (cutting: unreported cuts are lost; stitching/packing: the joined workers are taken off it).
   Purpose: the owner must know they're cancelling work someone is doing right now.
3. Cancelled batch whose spares were all reused shows "0 · 0 / 0" in the batch list and an empty Units grid.
   Show what happened instead (e.g. "All 5 mats reused in B-2026-050" with a link; units of a cancelled batch
   that moved on are found via batch_units.reused_from). Keep it small: a read in Get/list + a line of UI.
   Purpose: today it looks like lost data.
4. Phone texts: everything user-facing goes in apps/mobile/lib/strings.ts (Hindi is planned). Known leftovers
   in apps/mobile/app/batch/[id].tsx ("Couldn't do that", "Done ✓", the short-count Alert, "Report cut",
   "Start cutting", "Join batch", "Open scanner", the not-found texts …) and in app/scan/[batchId].tsx
   ("Already scanned", "Your share is complete ✓", quota subtitle, "Not an RPS unit label",
   "Offline — reconnect to scan", "Scan failed — try again") — sweep all of apps/mobile/app + components.
   Pure move, no wording changes unless one is wrong.
5. Outdated docs: docs/rps-kb/08-roadmap/remaining-slices.md "Later / maybe never" still lists "batch cancel/edit"
   and "packages/shared types" (both built); README.md "Last updated: 2026-09-13 … Week 9 / Slice A.2" is stale;
   check status-and-next.md and backlog-v2.md the same way. Fix what's wrong; don't rewrite what's right.
6. Browser check of the admin screens nobody has seen working: Spare mats → Write off dialog (needs a cancelled
   batch with spares on rps_test), and that Edit / Cancel batch / Release / Undo open with a REAL mouse click
   (see the browser note below — tell me if you couldn't confirm a real click).
7. Phone app on a device: list exactly what I must check on a real phone (the agent can't run it): cutter
   "Give back this batch"; My work card (today / week / rework lines for each station); scanning a spare
   ("Spare stock — keep it aside"); packer scanning a reused stitched spare whose code is from another batch
   (must pack, not "Wrong batch"); packer scanning a mat of another batch (must say "Wrong batch"). Write it as
   a short checklist in docs/rps-kb/06-operations/testing.md and give it to me at the end.

For every item: say what was wrong, fix it, add or extend a test where the codebase has one for that layer
(Go tests on rps_test; Postman for API behaviour), and keep the fix the smallest that's fully right.

HOW TO VERIFY (lessons from earlier sessions)
- Tests/Postman only on rps_test: scripts/test-db.sh, TEST_DATABASE_URL=...rps_test. Never touch rps.
- Second backend: cd apps/backend && DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server;
  admin: cd apps/admin-web && NEXT_PUBLIC_API_URL=http://localhost:8082/api/v1 pnpm dev --port 3000.
- Newman: npx --no-install newman run apps/backend/RPS.postman_collection.json -e apps/backend/RPS-test.postman_environment.json
  (fix item 1 so the documented command works, then use exactly that).
- Edit the Postman JSON with json.load + json.dumps(indent=2, ensure_ascii=True) and NO trailing newline (round-trips
  the file byte-for-byte; `git diff --stat` should show only your changes).
- admin-web has noUncheckedIndexedAccess on; there's no web test runner.
- Browser checks (Claude in Chrome): the extension's simulated mouse clicks did NOT open Radix triggers
  (Dialog/AlertDialog/Select/Popover — even the old "New batch" button) in the last session, while a page-script
  element.click() did. Try a real click first; if it fails, use element.click() + keyboard for Selects and say
  clearly that a real click wasn't confirmed. Dev login fields show placeholders, not values; fill them.
- The scratchpad is wiped when a session restarts: re-create servers/files rather than assuming they exist.
- The owner's dev DB `rps` may lag the migrations; give the migrate command, don't run it.
- Merging to master: AGENTS.md says don't switch to master; earlier merges used a temporary `git worktree`
  of master + `git merge --no-ff`. Only merge / push when I ask.
- Run the full AGENTS.md verify list + scripts/review.sh master before saying done; show output in a fenced
  block separate from summaries (the owner once pasted a summary into the shell).

Start by confirming you've read this and the code for items 1–3, say anything in the list that turned out to be
wrong or already fixed, then work through the items in order. Ask me only if a fix would change behaviour the
owner would notice beyond the item's purpose.
```
