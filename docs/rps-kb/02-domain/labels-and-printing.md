# Labels & Printing

## Generator
`apps/admin-web/features/batches/label-pdf.ts` → `generateLabelPdf(batch: BatchDetail, media: "taffeta" | "sticker" = "taffeta")`.
jsPDF + `qrcode`. A4, `cols × rows` per media (both 3×8 today — **sticker dims change once the printer/roll is known**).
Each label: QR (payload = bare `unit_code`, e.g. `B-2026-005-003`), unit code (mono bold), brand + model, "RIDDHI Car Floor Laminates".
Saves `<batch_code>-labels.pdf` / `<batch_code>-stickers.pdf`.

The QR payload is the bare unit code; the mobile scanner validates `^B-\d{4}-\d{3}-\d{3}$`. Change one → change the other.

## When things print
| Label | Trigger | UI |
|---|---|---|
| Taffeta (unit, fabric, stitched into mat) | Admin clicks **Assign & print labels** (batch entering stitching) | `assign-stitchers-card.tsx` → `save(true)` |
| Taffeta reprint | Any time | Batch detail → "Labels PDF" |
| Packing sticker (unit, paper, on polybag) | Batch enters packing → Batches → Packing view → **Print stickers** (→ "Reprint" once `stickers_printed_at` set via `POST /batches/:id/stickers-printed`) | `batch-list.tsx` `stickerColumn` |
| Enrollment QR | Create-worker success screen; Workers list → QR icon | `qrcode.react`, payload `RPS-ENROLL:<badge_token>` |

Owner-friendly rule: **each stage's labels print when work arrives at that stage.**

## Sticker + rework (settled)
Stickers are unique per mat (owner: "full details, same as inner"). The strip prints at packing entry and **stays at the
packing table** — a station artifact, not a mat artifact. A reworked mat leaves its sticker on the strip; when it returns
and passes, the packer peels it. Fallbacks: per-unit **reprint** (with Slice B); a kiosk print station (PC + Chrome
`--kiosk-printing` + a Packing Station page auto-printing per pack event) if a printer is ever placed *at* packing.

## Hardware notes (not purchased)
- Taffeta and paper stickers are different media; one thermal-transfer printer may do both by swapping rolls — confirm with vendor.
- Get roll dimensions (mm) before buying stock; QR ≥ 20 mm scans reliably from phones.
- Until then PDFs are scanned off a laptop/phone screen — the test method since Week 6.
