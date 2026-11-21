# Billing / GST link — plan (Nov 2026)

Status: **parked — future option, nothing agreed with the owner or the accountant yet. Don't start it.**
Raised by the owner on 15 Nov 2026 after seeing a reel about free, open-source replacements for Vyapar / Zoho.
The short entry is in `NEXT-STEPS.md` → "Future plan"; this file is the full reference.

## Goal

The accountant bills from Vyapar and types finished-goods numbers by hand. The goal is that the billing tool knows
how many mats of each item the factory finished, without retyping — and nothing more.

## The rule

**RPS stays production-only. No invoices, GST, customers, prices or payments inside RPS.** A billing tool runs
beside RPS and RPS hands it finished-mat counts.

Why:

- GST rules, the e-invoice format and return formats keep changing. A separate tool's maintainers carry that.
- It fits D40 (the app counts work; it never shows money).
- The users differ: the accountant bills, the floor makes mats.
- The candidates are other stacks (Node, Python). Running one as a separate service and using its files or API is
  clean; copying code in means a rewrite, and for ERPNext (GPL-3.0) it would put that licence on RPS.

## What RPS has today that matters here

- **The item**: one `car_models` row = brand + model + size + product line (`uq_car_models_item`), with its own
  barcode (migration 008). This is the thing a billing tool calls an "item".
- **Finished counts**: Reports → Overview → "Item mix (packed)" already downloads a CSV for any date range:
  Car, Product line, Mats packed (`apps/admin-web/app/(dashboard)/reports/page.tsx`, helper
  `features/reports/lib/csv.ts`, data from `GET /reports/overview` → `items[]`).
- **Finished stock**: `GET /stock/finished` — packed mats per model. It only ever goes up, because nothing sets a
  mat to `dispatched` yet (audit W6, owner question 9).
- **Material purchases**: receiving a lot stores `qty`, `unit_cost`, `supplier` (`POST /materials/lots`).
- **Live hook**: every write already goes through the `internal/live` middleware (D43); a batch reaching
  `completed` writes a `completed` batch event.

What RPS does not have: customers, prices, HSN codes, tax rates, dispatch. Under this plan it never gets the first
four; dispatch is a separate question (below).

## Stages — each one is optional and useful on its own

### Stage 0 — today, no code

The accountant downloads "Item mix (packed)" for the day or week and enters the numbers in Vyapar. Try this first:
it shows whether a link is wanted at all, and what the accountant needs that the file lacks.

### Stage 1 — an export the billing tool can import (small)

Only if stage 0 shows the retyping is a real cost.

- Add the item's **barcode**, **brand**, **model**, **size** as separate columns to the export, plus the date
  range, so each row matches one item in the billing tool by code rather than by name.
- One-time setup by the accountant: each Vyapar item gets the RPS barcode as its item code.
- Check first with the accountant: **which file Vyapar can import to add stock to existing items**. Vyapar imports
  items from Excel; whether it can import a stock increase for items that already exist has not been checked. If it
  can't, stage 1 gives a cleaner sheet to type from, not an import.
- CSV vs .xlsx: the web app has a CSV helper and no Excel library. Use CSV if the tool takes it; add an Excel
  library only if it doesn't.
- Size: admin web only, plus `car_models.barcode` on `items[]` in `GET /reports/overview` if it isn't there.

### Stage 2 — replace Vyapar (the accountant's decision, not a code task)

Only if the owner wants to stop paying for Vyapar or wants the automatic link in stage 3.

1. Pick a candidate (table below).
2. Install it and import the Vyapar data.
3. Run it **beside Vyapar for one month**: every bill made in both.
4. The CA checks a sample invoice, the GSTR-1 output, and whether the turnover requires e-invoice (IRN).
5. Switch only when the CA and the accountant both say yes.

Moving the books is the risky part of this whole plan. RPS work is not needed for it.

### Stage 3 — automatic push (only with a tool that has an API)

When a batch completes, RPS adds the finished mats to the billing tool's stock.

- **Outbox, not a direct call**: a table of pending pushes written in the same transaction that completes the
  batch; a background worker sends them and retries. The billing tool being down must never fail or slow a
  packer's scan.
- **One push per batch, sent once**: keyed by batch id so a retry can't add stock twice.
- **Corrections**: an undo of a pack scan (U3, D38) can reopen a completed batch. The push must handle that —
  either send a reversing entry or push only after a quiet period. Decide before building.
- **Item mapping**: `car_models.barcode` ↔ the billing tool's item code. A push for an unknown code is held and
  shown to the admin, never guessed.
- **Settings**: billing URL + API key in the backend `.env` (never logged, AGENTS rule 5). Off when unset.
- **Admin web**: a small "Billing sync" status (last push, held pushes) and nothing else. No billing screens.
- Size: one migration (outbox), one backend package, a decision entry, tests against a fake billing server.

### Later, only if asked

- Material purchases → billing tool as purchase entries (RPS has supplier and unit cost per lot).
- Dispatch. Invoices happen when mats leave, not when they are packed. If RPS ever tracks dispatch (audit W6),
  the billing tool's invoice is the natural source: selling there reduces stock there. RPS should not become a
  second place where sales are entered.

## Candidates

All of this comes from each project's own README on 15 Nov 2026. **None was installed or run, and none was checked
by the CA.**

| Tool | What it is | Link to RPS | Risk |
| --- | --- | --- | --- |
| [Free GST Billing Software](https://github.com/IamRamgarhia/Free-GST-Billing-Software) (probably the one in the reel) | Vyapar-like desktop app. React + Node, data in plain JSON files, MIT. GST invoices, stock, GSTR-1/3B, imports Vyapar and Tally exports, CSV / Excel import. 509 stars, 214 forks, release 14 Nov 2026. | File only (stage 1). No API documented. | Books are files on one PC; backups matter. E-invoice not mentioned. |
| [Simple Invoicing](https://github.com/nikhilb2/simple-invoicing-free-gst-billing-software) | Server app. FastAPI + React + PostgreSQL 16, Docker, MIT. GST invoices, stock, GSTR-1 JSON, e-way bill JSON for bulk upload, bills of materials and production records. | REST API under `/api`, API keys, Swagger at `/docs` (stage 3). | Young and small: 19 stars, two named contributors, 22 open issues, no releases. E-invoice not mentioned. |
| [ERPNext](https://erpnext.com/regional/open-source-erp-for-india) + India Compliance app | Full ERP, GPL-3.0, about 39k stars, widely used in India; e-invoice and e-way bill through the compliance app. | Mature REST API (stage 3). | Heavy to install and run; a lot for one accountant to learn. Worth it only if purchase, payroll and accounts should live in one place. |

Also seen, not looked at closely: Nexuzy-Ledger (offline GST accounting, MIT), Hisaabo (self-hosted, its own
"O'Saasy" licence).

## Recommendation

Stage 0 now. Stage 1 if the accountant asks for it. Stages 2 and 3 only if the owner decides to leave Vyapar — and
then Free GST Billing Software if the aim is "same as Vyapar but free", Simple Invoicing if the aim is the automatic
link.

## Questions for the owner and the accountant (before any stage past 0)

1. How do finished-goods numbers reach Vyapar today — typed per day, per week, or not at all (stock not kept there)?
2. Is stock kept in Vyapar at all, or only invoices?
3. Can Vyapar import a stock increase for existing items, and from which file layout?
4. Do Vyapar items match RPS items one to one (brand + model + size + line), or are they coarser (e.g. one item
   per size)?
5. Is the reason to look at replacements cost, missing features, or the automatic link?
6. Does the turnover require e-invoice (IRN)? (CA)
7. Where would a billing server run — the same machine as RPS, or the accountant's PC?
