# M1 — Work history on the worker phone — hand-off prompt (Nov 2026)

Status: **planned, not started.** Paste the prompt below into a new agent session.
Owner direction (11–13 Nov 2026): the app's purpose is to show how much work each worker did; the owner pays wages
himself from those counts (D40 — never ₹ in the app). Workers should be able to see their own counts per day and per
month on the phone, so there is no argument on payday.

**Owner decision (13 Nov 2026):** a mat a stitcher stitched that was later **written off** keeps counting as stitched —
the phone shows the same number as the admin, with no separate "written off" line.

```text
Do slice M1 — work history on the worker phone. Read AGENTS.md first, then docs/rps-kb/README.md,
docs/rps-kb/08-roadmap/NEXT-STEPS.md, docs/rps-kb/05-mobile/structure.md and decision D39–D41 in
docs/rps-kb/07-decisions/decision-log.md.

GOAL
A worker opens "My work" on the phone and sees their own output per day for a month, with the month total, and can
go back to earlier months. Counts only — never money, rates or earnings (D40). Nothing else changes. If something
starts to look like another feature (targets, ranking against other workers, export, attendance), stop and ask me.

STATE
- master = 4936cb4 (H1 merged): phone is English + Hindi; texts via useStrings()/getStrings() from lib/language.ts,
  tables in lib/strings.ts and lib/strings.hi.ts (type check fails on a missing Hindi key).
- Work on branch agent/m1-work-history (created from master; only adds this hand-off). Never commit on master.
- No Claude co-author / attribution lines. Commit style "[M1] ...", one commit per step.

WHAT EXISTS (read before writing anything)
- Phone: components/MyWorkCard.tsx on home (today / this week + rework lines), features/me/{api,hooks}.ts,
  GET /worker/me/summary (internal/worker/mywork.go, MySummary — week only).
- Counting, already used by the admin worker page and Reports → Workers: internal/worker/profile.go outputSQL() +
  days(): per factory day (IST, internal/factorytime) — cutter: phase_logs.quantity_completed by completed_at;
  stitcher: batch_units.stitched_by by stitched_at; packer: batch_units.packed_by by packed_at.
  Admin reads it through GET /workers/:id/summary?from&to (Service.Summary).
- These follow from that SQL — don't change them, but know them: an undone scan removes the mat from the count; a mat
  of a cancelled batch that became spare stock keeps its stitcher's credit; a reused stitched spare stays on the day
  and the stitcher it was first stitched by; a written-off mat still counts (owner, 13 Nov 2026: keep it the same as the admin).

RULE THAT MATTERS MOST
The phone must show exactly the numbers the admin shows for the same worker and days — the owner pays from the admin
numbers and the worker checks on the phone. Reuse days(); do not write a second counting query. A Go test must compare
the new endpoint with Service.Summary for the same range.

THE LIST
1. Backend — one read endpoint, worker token only (same guard as /worker/me/summary):
   GET /worker/me/history?month=YYYY-MM (default: the current factory month)
   → { station, unit, month, total, days_worked, days: [{ day: "YYYY-MM-DD", mats }], first_month: "YYYY-MM" }
   - days: only days with output, oldest first; the current month stops at today.
   - first_month: the month of the worker's first output (or the current month if none) — the phone stops there.
   - 400 for a malformed month or a month in the future. No new table, no migration.
   - Do NOT send first/last scan times or active seconds to the phone (workers don't need them; keep the payload small).
   - Written-off mats: no change — they count, exactly as on the admin (owner, 13 Nov 2026). No "written off" line.
   Types in packages/shared (never redeclare in the app).
2. Phone screen app/history.tsx, opened by tapping the My work card (whole card is the button, ≥ 48 px, with a small
   "see month" hint so it looks tappable):
   - Header with the drawn back arrow (BackIcon/BackLabel from H1) and the title "My work".
   - Month row: ‹ previous · "November 2026" · next › — next disabled on the current month, previous disabled at
     first_month. Month names come from strings (both languages); don't rely on Intl month names on Hermes.
   - Big month total with the station's unit (pieces cut / mats stitched / mats packed) and "N days worked".
   - One row per worked day, newest first: weekday + date on the left ("Mon 3"), count on the right, tabular digits
     0–9. Today is marked. No bars or charts unless they fit in one line of code with existing tokens.
   - States: skeleton while loading; empty month → "No work recorded this month"; error → Banner with Retry; offline →
     the existing offline banner and whatever is cached.
   - Screen / ScreenHeader, tokens from lib/theme.ts only, both themes. No hex, no raw font sizes.
   - TanStack Query: key ["my-history", month]; the current month refetches like the card (1 min + pull to refresh);
     past months are cached for the session (they don't change, except an admin undo — fine).
3. Texts in lib/strings.ts AND lib/strings.hi.ts, read through useStrings(); add every line to
   docs/rps-kb/05-mobile/hindi-texts.md. Plain floor Hindi, same style as H1; mark unsure lines with "?".
   Weekday and month names in Hindi are part of this.
4. Tests:
   - Go (rps_test via testutil.DB): a stitcher with scans on two days of one month and one in the previous month →
     the month's days and total equal Service.Summary for the same range; previous month separate; first_month right;
     an undone scan disappears; future month → invalid; a packer and a cutter return their own unit. Don't write a
     test that depends on the clock being away from midnight (TestWorkerPage already fails 00:00–00:02 IST — if you
     touch that file, fix it by not stamping scans relative to NOW()).
   - Postman: add the requests to the "Workflow corrections (U3b)" folder next to "My work (stitcher)" (200 + shape,
     bad month 400, future month 400, admin token 401). Edit the JSON with json.load + json.dumps(indent=2,
     ensure_ascii=True), no trailing newline. Full run from the repo root must stay at 0 failures.
5. Docs: 03-backend/api-reference.md (the endpoint), 05-mobile/screens-and-flows.md (the screen),
   07-decisions/decision-log.md D42 (work history: counts only, same numbers as the admin; written-off mats keep counting — owner, 13 Nov 2026),
   06-operations/testing.md — a short "Work history on a real phone" checklist (open from the card; totals equal
   admin Reports → Workers for that worker and month; previous / next month limits; Hindi; largest font size; offline;
   a scan made now shows within a minute; an admin "undo scan" lowers it). Tick M1 in NEXT-STEPS when merged.

OUT OF SCOPE (ask before doing any of it)
₹ / rates / earnings (D40) · seeing other workers' numbers · targets or bonuses · PDF / share / export from the phone ·
the "assigned to you" notification (needs the EAS build, Slice E) · changing how the admin counts.

HOW TO VERIFY
- Tests and Postman only on rps_test: scripts/test-db.sh; second backend:
  cd apps/backend && DATABASE_URL=<rps_test url> PORT=8082 go run ./cmd/server; Newman from the repo root (testing.md).
- The agent can't run the phone app: say so, and give me the phone checklist at the end.
- Run the full AGENTS.md verify list + scripts/review.sh master before saying done. Commands in one fenced block,
  results OUTSIDE it — the owner pastes fenced blocks into the shell.
- Only merge / push when I ask (temporary git worktree of master + git merge --no-ff).

Start by confirming you've read this and the code named above, say anything here that turned out to be wrong, then
work through the list in order. Ask me only about Hindi wording or anything a worker would notice beyond this screen.
```
