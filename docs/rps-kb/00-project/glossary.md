# Glossary

| Term | Meaning |
|---|---|
| **Batch** | A production order: one car model × quantity. Code `B-YYYY-NNN` (per-year counter). |
| **Unit** | One physical mat. Code `B-YYYY-NNN-NNN`. Created with the batch (Hard Rule 18). |
| **Phase** | Where the batch is: `cutting → stitching → packing → completed`. Column `batches.current_phase` (enum `batch_phase`). |
| **Status** | State within the phase: `pending`, `in_progress`, `awaiting_assignment`, `completed`, `cancelled` (enum `batch_status`). |
| **Station** | A worker's role: `cutter`, `stitcher`, `packer` (enum `worker_station`). Maps 1:1 to a phase via `PhaseForStation`. |
| **Claim / Join** | A worker opening a `phase_logs` row on a batch+phase. Cutting = exclusive claim (one worker). Stitching/packing = join (many workers). Same endpoint: `POST /worker/batches/:id/start`. |
| **Assignment** | Admin-designated workers for a phase (`batch_assignments`). Stitching *requires* it (the gate). Optional per-head quota `target_qty`. |
| **Gate / Ready for stitching** | Status `awaiting_assignment`: cutting finished, batch parked with admin until stitchers are assigned. Invisible to all workers. |
| **Quota** | `batch_assignments.target_qty`: max mats a worker may scan in that phase. Must sum to batch quantity. Enforced at scan. |
| **Scan-per-mat** | Stitchers and packers record work by scanning each mat's QR on completion. Sets `stitched_by`/`packed_by`. |
| **Taffeta label** | Fabric unit label stitched into the mat. Printed at assignment. |
| **Packing sticker** | Paper unit label for the polybag. Printed when batch enters packing. |
| **Badge token** | Permanent per-worker secret used for enrollment (`workers.badge_token`). Shown as QR `RPS-ENROLL:<token>`. |
| **Enrollment** | One-time login on a phone: badge (scan or type) + 4-digit PIN → 30-day token in SecureStore. |
| **Rework** | (Slice B, not built) Packer rejects a mat → goes back to its stitcher with photo + reason. |
| **BOM** | (Slice C, not built) Bill of materials per car model: material type × qty per mat. |
| **Hard Rules** | Numbered rules from the original spec doc. Notable: #16 audit in same tx, #18 units created at batch creation. |
