DROP TABLE piece_rates;
DROP INDEX IF EXISTS idx_phase_logs_open_per_worker;
DROP INDEX IF EXISTS idx_phase_logs_open_cutting;
CREATE UNIQUE INDEX idx_phase_logs_open ON phase_logs (batch_id, phase) WHERE completed_at IS NULL;
ALTER TABLE batch_units DROP COLUMN stitched_at, DROP COLUMN stitched_by;