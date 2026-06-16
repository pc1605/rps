-- ============================================================
-- RPS · Migration 002 · car refs + raw materials + batches + units
-- ============================================================

-- ───── ENUMS ─────
CREATE TYPE batch_phase  AS ENUM ('cutting', 'stitching', 'packing', 'completed');
CREATE TYPE batch_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE unit_status  AS ENUM ('pending', 'packed', 'defective', 'dispatched');

-- ───── car_brands ─────
CREATE TABLE car_brands (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL CHECK (char_length(name) > 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ───── car_models ─────
CREATE TABLE car_models (
  id              SERIAL PRIMARY KEY,
  brand_id        INT NOT NULL REFERENCES car_brands(id),
  name            TEXT NOT NULL CHECK (char_length(name) > 0),
  pieces_per_set  INT NOT NULL DEFAULT 5 CHECK (pieces_per_set > 0),
  piece_groups    INT NOT NULL DEFAULT 2 CHECK (piece_groups > 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand_id, name)
);

-- ───── raw_materials (rexine rolls) ─────
CREATE TABLE raw_materials (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  roll_code         TEXT UNIQUE NOT NULL,
  color             TEXT NOT NULL,
  total_meters      NUMERIC(10,2) NOT NULL CHECK (total_meters >= 0),
  remaining_meters  NUMERIC(10,2) NOT NULL CHECK (remaining_meters >= 0),
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rolls_active ON raw_materials(roll_code) WHERE is_active = TRUE;

-- ───── batches ─────
CREATE TABLE batches (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_code    TEXT UNIQUE NOT NULL,
  car_model_id  INT NOT NULL REFERENCES car_models(id),
  roll_id       UUID REFERENCES raw_materials(id),
  quantity      INT NOT NULL CHECK (quantity > 0),
  current_phase batch_phase NOT NULL DEFAULT 'cutting',
  status        batch_status NOT NULL DEFAULT 'pending',
  notes         TEXT,
  rework_count  INT NOT NULL DEFAULT 0,
  created_by    UUID NOT NULL REFERENCES users(id),
  version       INT NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_batches_status  ON batches(status);
CREATE INDEX idx_batches_phase   ON batches(current_phase);
CREATE INDEX idx_batches_created ON batches(created_at DESC);
CREATE INDEX idx_batches_model   ON batches(car_model_id);

CREATE TRIGGER set_batches_updated_at
  BEFORE UPDATE ON batches
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- ───── batch_units (individual mats) ─────
-- One row per physical mat. Created at batch creation (RPS Hard Rule #18).
-- Each carries a unique unit_code; the Riddhi taffeta QR encodes this.
-- packed_by FK to workers is added in the Week 3 workers migration.
CREATE TABLE batch_units (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id    UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  unit_code   TEXT UNIQUE NOT NULL,
  unit_number INT NOT NULL,
  status      unit_status NOT NULL DEFAULT 'pending',
  packed_by   UUID,  -- FK to workers(id) added in migration 003
  packed_at   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (batch_id, unit_number)
);

CREATE INDEX idx_units_batch  ON batch_units(batch_id);
CREATE INDEX idx_units_status ON batch_units(status);

-- ───── batch code generator (atomic, per-year) ─────
CREATE TABLE batch_code_counters (
  year        INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_batch_code()
RETURNS TEXT AS $$
DECLARE
  yr  INT := EXTRACT(YEAR FROM NOW())::INT;
  num INT;
BEGIN
  INSERT INTO batch_code_counters (year, last_number)
  VALUES (yr, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = batch_code_counters.last_number + 1
  RETURNING last_number INTO num;

  RETURN 'B-' || yr || '-' || LPAD(num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;