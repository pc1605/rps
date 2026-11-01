-- 019 (U3): undo of a stitch / pack scan by the owner or a supervisor is a typed batch event.
ALTER TYPE batch_event_kind ADD VALUE IF NOT EXISTS 'scan_undone';
