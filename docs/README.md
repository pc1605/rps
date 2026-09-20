# RPS — Riddhi Production System · Knowledge Base

**Ambika Enterprise → Riddhi Car Floor Laminates → RPS.**
Manufacturing tracking for a car floor-mat (rexine) factory in Ahmedabad. Built solo by the owner-developer
(GitHub `pc1605/rps`) starting July 2026. This KB is written so that any engineer or AI agent can continue the
work without the original conversation history.

> Last updated: 2026-09-13. State: **Week 9 / Slice A.2 complete on the backend; UI verification pending.**
> See `08-roadmap/status-and-next.md` for exactly where things stand.

## How to use this KB

1. Read `00-project/overview.md` (5 min) — the factory, the people, the pipeline.
2. Read `02-domain/work-model.md` — the single most important document. It defines how batches flow,
   who may touch what, and how scans record work. Most bugs come from misunderstanding this.
3. Set up locally with `06-operations/dev-setup-runbook.md`.
4. Before touching anything, skim `06-operations/gotchas.md` — every item cost real hours.
5. Check `07-decisions/decision-log.md` before proposing a design change; most "obvious" alternatives were
   already tried or argued against with the factory owner.

## Folder map

| Folder | What's in it |
|---|---|
| `00-project/` | Business context, glossary, factory owner's requirements and open questions |
| `01-architecture/` | Stack, ports, monorepo layout, auth model, coding conventions |
| `02-domain/` | Data model (all migrations), batch lifecycle, work/assignment model, labels, error catalog |
| `03-backend/` | Go package structure, full API reference, the critical queries explained |
| `04-admin-web/` | Next.js app structure and every screen |
| `05-mobile/` | Expo app structure, worker flows, build & networking |
| `06-operations/` | Daily runbook, testing (Postman + manual scripts), gotchas |
| `07-decisions/` | Decision log (ADR style) — the *why* behind everything |
| `08-roadmap/` | Current status, remaining slices with designs, backlog |

## Conventions used in this KB

- Paths are absolute on the dev machine: repo root is `~/Development/rps/` (`/home/brilworks/Development/rps/`).
- "Admin" = the factory owner/supervisor using the web app. "Worker" = cutter/stitcher/packer using the phone app.
- Anything marked **VERIFY** is believed true but was not directly confirmed against the code at write time.
