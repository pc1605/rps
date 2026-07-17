-- ============================================================
-- RPS · Migration 004 · phase_logs (who did what, when, how long)
-- ============================================================

CREATE TABLE phase_logs (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id            UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  phase               batch_phase NOT NULL,
  worker_id           UUID NOT NULL REFERENCES workers(id),
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ,
  quantity_completed  INT CHECK (quantity_completed >= 0),
  notes               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- THE CLAIM MECHANISM: at most ONE open (uncompleted) log per batch+phase.
-- The INSERT itself is the atomic claim — two workers tapping Start
-- simultaneously → second INSERT violates this index → clean rejection.
CREATE UNIQUE INDEX idx_phase_logs_open
  ON phase_logs(batch_id, phase) WHERE completed_at IS NULL;

CREATE INDEX idx_phase_logs_batch  ON phase_logs(batch_id);
CREATE INDEX idx_phase_logs_worker ON phase_logs(worker_id, started_at DESC);