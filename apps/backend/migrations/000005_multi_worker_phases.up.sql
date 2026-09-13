-- Units gain stitching attribution (scan-per-mat at stitching)
ALTER TABLE batch_units
  ADD COLUMN stitched_by UUID REFERENCES workers(id),
  ADD COLUMN stitched_at TIMESTAMPTZ;

-- Claim model: cutting stays exclusive; stitching/packing become joinable
DROP INDEX IF EXISTS idx_phase_logs_open;

CREATE UNIQUE INDEX idx_phase_logs_open_cutting
  ON phase_logs (batch_id, phase)
  WHERE completed_at IS NULL AND phase = 'cutting';

-- any worker: at most ONE open log per batch+phase (no double-join)
CREATE UNIQUE INDEX idx_phase_logs_open_per_worker
  ON phase_logs (batch_id, phase, worker_id)
  WHERE completed_at IS NULL;

-- Payroll: piece rates per station (₹ per piece)
CREATE TABLE piece_rates (
  station worker_station NOT NULL PRIMARY KEY,
  rate_per_piece NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);