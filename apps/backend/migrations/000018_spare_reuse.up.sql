-- 018 (U3): reusing spare mats on a new batch. A reused unit moves to the new batch (batch_id changes);
-- reused_from keeps the cancelled batch it came from. prestitched = it was already stitched when it
-- moved: it counts as stitched in the new batch, the original stitcher keeps the credit (stitched_by),
-- and it is left out of the new batch's per-stitcher quotas and done counts.
ALTER TABLE batch_units
  ADD COLUMN reused_from UUID REFERENCES batches(id) ON DELETE SET NULL,
  ADD COLUMN prestitched BOOLEAN NOT NULL DEFAULT false;
