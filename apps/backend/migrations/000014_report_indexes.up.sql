-- Indexes for per-worker attribution, rework lookups and related batches.
-- Feeds: worker pages / reports (stitched_by, packed_by + time), quota checks,
-- rework per batch and by date, parent → child batch lookups.
CREATE INDEX IF NOT EXISTS idx_units_stitched_by ON batch_units (stitched_by, stitched_at) WHERE stitched_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_units_packed_by   ON batch_units (packed_by, packed_at)     WHERE packed_by IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_rework_batch      ON rework_logs (batch_id);
CREATE INDEX IF NOT EXISTS idx_rework_flagged_at ON rework_logs (flagged_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_parent    ON batches (parent_batch_id) WHERE parent_batch_id IS NOT NULL;
