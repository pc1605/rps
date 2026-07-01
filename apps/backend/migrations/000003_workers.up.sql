-- ============================================================
-- RPS · Migration 003 · workers (badge QR + PIN two-factor)
-- ============================================================

CREATE TYPE worker_station AS ENUM ('cutter', 'stitcher', 'packer');

-- ───── workers ─────
-- Two-factor identity: badge_token (something you HAVE, encoded in QR)
-- + pin_hash (something you KNOW). Both required to log in.
-- This defeats count-theft: stealing a PIN alone is useless without the badge.
CREATE TABLE workers (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL CHECK (char_length(name) > 0),
  phone           TEXT,
  station         worker_station NOT NULL,
  -- badge_token: random secret embedded in the worker's QR badge.
  -- Opaque, unguessable. The QR encodes this; login matches against it.
  badge_token     TEXT UNIQUE NOT NULL,
  -- pin_hash: bcrypt of the worker's 4-digit PIN.
  pin_hash        TEXT NOT NULL CHECK (char_length(pin_hash) >= 60),
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  deactivated_at  TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workers_active   ON workers(station) WHERE is_active = TRUE;
CREATE INDEX idx_workers_badge    ON workers(badge_token) WHERE is_active = TRUE;

CREATE TRIGGER set_workers_updated_at
  BEFORE UPDATE ON workers
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ───── now wire up the deferred FK from batch_units.packed_by ─────
-- (migration 002 created packed_by UUID without the constraint, because
--  workers didn't exist yet. Add it now.)
ALTER TABLE batch_units
  ADD CONSTRAINT fk_batch_units_packed_by
  FOREIGN KEY (packed_by) REFERENCES workers(id);