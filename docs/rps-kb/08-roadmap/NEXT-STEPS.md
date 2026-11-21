## Next, in order (updated after the product audit — see docs/rps-kb/10-product-audit/audit.md)

| #   | Slice                     | Contains                                                                                                                                                                                                             | Depends on | Folder               |
| --- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | -------------------- |
| U0 ✅ | Bugs & quick fixes       | F15 stitching completion (data correctness), F04 BatchStats type, mobile queue sort, other S-effort correctness fixes                                                                                                | —          | main                 |
| C1 ✅ | Materials backend        | C1a schema (migration 015) + shared types · C1b recipe resolution + consumption engine · C1c endpoints                                                                                                               | U0 merged  | worktree `../rps-c1` |
| U1 ✅ | Entity pages & navigation | Worker page (current work, pipeline history, output, rework caused/fixed, enrollment QR, PIN reset, activate), Unit/Mat, Car item, Lot pages; every worker/batch/unit/car/lot name clickable everywhere; breadcrumbs | U0         | main                 |
| U2 ✅ | Lists                    | whole-row click on every table, header search (batch code, unit code, barcode, worker, car), filters+sort in URL, server pagination for batches                                                                      | U1         | main                 |
| C2 ✅ | Materials admin screens  | Materials (types, variants, lots, receive/adjust, movements), Recipes grid, groups + overrides in car dialog, "Materials used" on batch                                                                              | C1, U1, U2 | main                 |
| R1 ✅ | Reports v2               | WIP ageing + stuck batches (also on dashboard), throughput, cycle time per phase, first-pass yield, worker output/hour, short-cut rate; CSV export                                                                   | U2         | main                 |
| U3 ✅ | Workflow gaps            | stitching assignment UX + reassign mid-stitching (hand-over) · edit before cutting, cancel → spare stock + reuse on New batch, release claim, undo scan, My work card (D34–D39; migrations 017–019)                                                                                                            | U2         | main                 |
| P1 ✅ | Make it perfect          | Owner priority (Nov 2026): no new features — Postman fully green, cancel-dialog warning, reused-spares display, phone texts in strings.ts, stale docs, last browser + real-phone checks (hand-off: `p1-perfection-handoff.md`); also lot code optional on Receive. Real-phone checklist (testing.md) still to be run by the owner | U3         | main                 |
| H1 ✅ | Hindi on the phone       | English + Hindi on the worker app before the pilot: language picker (login + home), Hindi texts typed against English, shared labels + server error codes in Hindi, Devanagari font, layout pass, owner reviews wording (hand-off: `h1-hindi-handoff.md`). Built; the owner still has to review the wording (`05-mobile/hindi-texts.md`) and run "Hindi on a real phone" (testing.md). Built on `agent/h1-hindi` (D41); before merge the owner reviews `05-mobile/hindi-texts.md` and runs "Hindi on a real phone" in testing.md | P1 | main |
| M1 ✅ | Work history on the phone | The worker's own counts per day and month, opened from the My work card; same numbers as the admin, never ₹ (D40); one read endpoint `GET /worker/me/history?month=`; English + Hindi (hand-off: `m1-work-history-handoff.md`). Written-off mats keep counting, same as the admin (owner, 13 Nov 2026; D42). Built on `agent/m1-work-history`; the owner still has to run "Work history on a real phone" (testing.md) and review the new Hindi lines (`05-mobile/hindi-texts.md` 212–236) | H1 | main |
| RT1 ✅ | Live updates | The admin web and the phone follow changes as they happen: `GET /live` (server-sent events) sends "changed" after every successful write, the apps re-read their live queries; polling stays as a once-a-minute fallback (D43, supersedes the realtime part of D14). Built on `agent/rt1-live-updates`; the owner still has to run "Live updates (RT1)" in testing.md on real phones. One backend instance only — decide LISTEN/NOTIFY in E2 | M1 | main |
| R2 ⏸ | Material reports (on hold, owner Nov 2026) | consumption vs recipe, waste, cost per mat                                                                                                                                                                           | C2         | main                 |
| E   | Hardening & deploy        | E1 security · E2 deploy · E3 EAS · E4 factory pilot                                                                                                                                                                  | U3         | main                 |

### Future plan (not discussed with the owner yet — don't start)

- **Worker helpers after the pilot** (owner, 11 Nov 2026; nothing designed yet):
  - Owner wants: an **"assigned to you" notification** (needs the EAS build, E3). Work history moved up: slice M1.
  - Maybe, if the pilot shows a need: spoken scan feedback in Hindi, offline scan queue (if floor Wi-Fi drops),
    first-use picture guide per station.
  - Not doing: earnings / ₹ on the phone or admin (D40 — the owner pays manually from the counts).

- **C3 Cutter materials** — "You'll need …" panel for the cutter, roll QR scan at cutting start, lot QR labels.
  Why it would matter: material is deducted at cutting-complete from the roll picked on New batch, else the oldest
  roll (FIFO). If the cutter cuts from another roll, total stock stays right but the wrong roll goes down; a roll scan
  would fix per-roll counts at the cost of a scan per batch and a label on every roll. Only worth it if the owner
  tracks each roll's remaining metres. Draft plan: `c3-handoff.md` (parked).

- **Billing / GST link** (owner, 15 Nov 2026; nothing designed yet). The accountant uses Vyapar today. RPS stays
  production-only — no billing or GST code inside RPS; a billing tool runs next to it and RPS hands over finished mats.
  Full plan: `billing-gst-plan.md` (parked).
  - Today, no code: Reports → Overview → "Item mix (packed)" CSV already gives mats packed per item for a date range.
  - First step, if wanted: add barcode / brand / model / size columns to that export so rows match billing items by
    code — works with Vyapar now and with a replacement later.
  - Possible Vyapar replacements, from their READMEs only (not run, not checked by the CA):
    - `IamRamgarhia/Free-GST-Billing-Software` — Vyapar-like desktop app, MIT, imports Vyapar data; no API, so the
      link is the Excel file.
    - `nikhilb2/simple-invoicing-free-gst-billing-software` — FastAPI + PostgreSQL, Docker, MIT, REST API with API
      keys; RPS could push finished mats as stock on batch complete. Small, young project — trial beside Vyapar first.
    - ERPNext + India Compliance — mature, REST API, GPL-3.0 (run as a separate service, don't mix code); heavy,
      only if purchase / payroll / accounts should live in one place.
  - Before real bills on any of them: CA checks a sample invoice and the GSTR-1 output, and whether e-invoice (IRN)
    is required for the turnover (the two small projects don't mention it).

- **Feature requests → future map** (owner, 21 Nov 2026; nothing built). A chat assistant (Claude / ChatGPT / Gemini
  project) answers "can RPS do X?" from `docs/rps-kb/11-assistant/` (prompt + a plain-language snapshot of what RPS can and
  cannot do — refresh it when features change) and writes a request card for anything RPS can't do or anyone
  wants changed.
  - Now, no code: people send the card to a Google Form → Google Sheet (or a WhatsApp group); the Sheet is the future map.
  - Later, after the server is live (E2): a **Requests** list in the admin (who, what, why, importance, status new /
    planned / done / declined) and a **Claude custom connector** (remote MCP on the RPS server, own login/key; Claude
    free allows one) with a "save request" tool, so the chat saves the card straight into RPS. Only Claude can do this
    today — ChatGPT custom GPT actions are being retired for new GPTs, Gemini Gems can't call an API.
  - Maybe later, separate decision: live read-only answers through the same connector ("Baleno mats packed this
    week?") — needs a decision on who may see which numbers.

Parallel rule: two agents may run at once only in separate folders (git worktree) on separate branches,
and only when they don't touch the same files. Merge order: U0 → C1 → U1 → U2 → C2 → …

### Decisions taken (defaults until the owner says otherwise)

- "Stuck" batch: no activity for 24 h in cutting / ready for stitching, 48 h in stitching/packing — configurable on
  Reports → Thresholds since R1 (`app_settings.stuck_hours`).
- Search covers batch code, unit code, barcode, worker name, car name.
- Worker pages are admin-only.
- Deferred (not over-engineering now): ⌘K palette & keyboard shortcuts, audit-log viewer,
  full settings page, pagination outside the batch list.

### Open owner questions (from the audit)

- ~~What happens to a stitcher's remaining quota when they're absent mid-batch?~~ Handed over to another stitcher (D32, built in U3).
- ~~Who may cancel a batch after cutting (owner only, or supervisors too)?~~ Owner and supervisors, until the first pack (D35, U3).
- ~~Should workers see their own output/earnings on the phone?~~ Output yes (My work card, D39, U3); never money — the owner pays manually from the counts (D40).
- What counts as a "late" batch (due dates per order?)
