-- Cutting-complete now parks the batch with the admin until stitchers are assigned.
ALTER TYPE batch_status ADD VALUE IF NOT EXISTS 'awaiting_assignment';

-- Admin-assigned workers per phase (stitching is the mandatory gate).
CREATE TABLE batch_assignments (
  batch_id    UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  phase       batch_phase NOT NULL,
  worker_id   UUID NOT NULL REFERENCES workers(id),
  assigned_by UUID NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (batch_id, phase, worker_id)
);
CREATE INDEX idx_assignments_worker ON batch_assignments (worker_id, phase);

-- Packing-sticker print tracking (Packing tab badge).
ALTER TABLE batches ADD COLUMN stickers_printed_at TIMESTAMPTZ;