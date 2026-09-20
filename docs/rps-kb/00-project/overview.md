# Project Overview

## The business
**Ambika Enterprise** operates a small factory unit, **Riddhi Car Floor Laminates**, making car floor mats from rexine
(synthetic leather) in Ahmedabad, Gujarat. RPS is the internal production-tracking system. It is private — not on any
app store, used only by the factory's own people.

## The physical process
```
Rexine roll + other materials (velcro, thread, piping)
   → CUTTING   (2 manual cutters + 1 cutting machine, working in parallel on different batches)
   → STITCHING (several stitchers; a batch is split between them, each stitches whole mats)
   → PACKING   (packer inspects each mat, bags it; defective mats go to rework)
   → Finished stock (stockyard) → dispatch
```

A **batch** is a production order: one car model × N mats (e.g. "Baleno × 10"). Each mat is a **unit** with its own
code `B-YYYY-NNN-NNN` (batch code + 3-digit unit number). Units exist in the database from the moment a batch is created.

## Labels (two kinds)
- **Taffeta label** — fabric label with unit QR, stitched *into the mat's seam during stitching*. Permanent identity of the mat.
  Printed at the moment the admin assigns the batch to stitchers.
- **Packing sticker** — paper sticker with the *same* full details (unit QR etc.), stuck on the polybag by the packer.
  Printed as a strip when the batch reaches packing. Unique per mat.

No printer has been purchased yet: both are generated as **print-ready PDFs** and, for now, scanned off a screen.
The PDF *is* the print pipeline — when a thermal/label printer arrives, the only change is label dimensions.

## People / roles
| Role | Device | What they do |
|---|---|---|
| Owner / admin | Laptop, web app | Creates batches, assigns stitchers (with per-head quotas), prints labels, watches dashboard/reports, enrolls workers |
| Cutter | Own Android phone | Pulls batch from cutting queue, Start → Complete (enters count) |
| Stitcher | Own Android phone | Sees only batches assigned to them; Join → scans each mat's label as it's finished |
| Packer | Own Android phone | Join → scans each mat's label as it's packed (rework option coming — Slice B) |

Workers use **their own smartphones**; the phone is their identity after a one-time enrollment (QR scan or typed code + PIN).

## Pay model (drives design)
Stitchers are paid **piece-rate (₹ per mat, e.g. ₹100)**. Therefore per-mat scan attribution is not just tracking —
it is the wage sheet. `piece_rates` table exists; Earnings view is planned (Slice D).

## Timeline so far
- Jul 2026: Weeks 1–4 — auth, batches/units, worker app, phase state machine.
- Aug 2026: Weeks 5–7 — stock, timeline, QR labels + camera scanning, reports. Demo prep.
- Early Sep 2026: Client demo → owner feedback rewrote the flow (see `owner-requirements.md`).
- Sep 2026: Week 8–9 — multi-worker stitching/packing, assignment gate, quotas, QR enrollment, admin phase tabs.
