-- 015 · Materials (Slice C1a). Design: docs/rps-kb/02-domain/materials.md
--   types → variants (specs that change consumption, e.g. roll width) → lots (colour, qty) → movements (ledger)
--   recipes keyed by product_line × consumption_group, lines per (type, variant?); per-car overrides.
-- raw_materials is RENAMED to material_lots (ids kept → batches.roll_id FK follows; column renamed in C2).

CREATE TYPE material_unit AS ENUM ('m', 'sqm', 'pcs', 'spool', 'kg');
CREATE TYPE movement_kind AS ENUM ('receive', 'consume', 'adjust', 'waste', 'return');

-- ───── material types ─────
CREATE TABLE material_types (
  id            SERIAL PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  unit          material_unit NOT NULL,
  has_variants  BOOLEAN NOT NULL DEFAULT FALSE,
  min_level     NUMERIC(12,3) CHECK (min_level >= 0),   -- low stock: SUM(active lots.qty_remaining) < min_level
  sort          INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The four sheet materials are separate types (owner decision), unit metres, varying by roll width.
INSERT INTO material_types (code, name, unit, has_variants, sort) VALUES
  ('REX-R',  'Rexine R',   'm', TRUE, 10),
  ('REX-87', 'Rexine 87',  'm', TRUE, 20),
  ('PVC-18', 'PVC 1.8 mm', 'm', TRUE, 30),
  ('PVC-21', 'PVC 2.1 mm', 'm', TRUE, 40);

-- ───── variants: specs that change consumption (NOT colour) ─────
CREATE TABLE material_variants (
  id                SERIAL PRIMARY KEY,
  material_type_id  INT NOT NULL REFERENCES material_types(id),
  name              TEXT NOT NULL,                        -- e.g. '60″'
  specs             JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(specs) = 'object'),  -- e.g. {"width_in": 60}
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id, material_type_id)                           -- target of composite FKs: variant must belong to the type
);
CREATE UNIQUE INDEX uq_material_variants_name ON material_variants (material_type_id, lower(name));

-- ───── lots (was raw_materials) ─────
ALTER TABLE raw_materials RENAME TO material_lots;
ALTER TABLE material_lots RENAME COLUMN roll_code TO lot_code;
ALTER TABLE material_lots RENAME COLUMN total_meters TO qty_received;
ALTER TABLE material_lots RENAME COLUMN remaining_meters TO qty_remaining;   -- cached; = SUM(movements.qty)
ALTER INDEX raw_materials_pkey RENAME TO material_lots_pkey;
ALTER INDEX idx_rolls_active RENAME TO idx_lots_active;
ALTER TABLE material_lots RENAME CONSTRAINT raw_materials_roll_code_key TO material_lots_lot_code_key;
ALTER TABLE material_lots RENAME CONSTRAINT raw_materials_total_meters_check TO material_lots_qty_received_check;
ALTER TABLE material_lots RENAME CONSTRAINT raw_materials_remaining_meters_check TO material_lots_qty_remaining_check;
ALTER TABLE material_lots
  ALTER COLUMN qty_received  TYPE NUMERIC(12,3),
  ALTER COLUMN qty_remaining TYPE NUMERIC(12,3),
  ADD COLUMN material_type_id INT REFERENCES material_types(id),
  ADD COLUMN variant_id       INT,                         -- NULL when the type has no variants (or unknown)
  ADD COLUMN unit_cost        NUMERIC(12,2) CHECK (unit_cost >= 0),   -- ₹ per unit
  ADD COLUMN supplier         TEXT,
  ADD COLUMN note             TEXT,
  ADD CONSTRAINT material_lots_variant_fkey
    FOREIGN KEY (variant_id, material_type_id) REFERENCES material_variants (id, material_type_id);
-- colour stays on the lot (`color`).

-- Backfill: every existing roll is a sheet lot. Type = the product line most used by its batches; default Rexine R.
UPDATE material_lots l
SET material_type_id = COALESCE(
  (SELECT mt.id
     FROM batches b
     JOIN car_models cm   ON cm.id = b.car_model_id
     JOIN product_lines p ON p.id = cm.product_line_id
     JOIN material_types mt ON mt.code = p.code
    WHERE b.roll_id = l.id
    GROUP BY mt.id ORDER BY COUNT(*) DESC, mt.id LIMIT 1),
  (SELECT id FROM material_types WHERE code = 'REX-R'));
ALTER TABLE material_lots ALTER COLUMN material_type_id SET NOT NULL;
CREATE INDEX idx_lots_type ON material_lots (material_type_id, received_at) WHERE is_active;

-- ───── movements: append-only ledger ─────
CREATE TABLE material_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id            UUID REFERENCES material_lots(id),     -- NULL = shortfall (consumed more than stock held)
  material_type_id  INT NOT NULL REFERENCES material_types(id),
  variant_id        INT,
  kind              movement_kind NOT NULL,
  qty               NUMERIC(12,3) NOT NULL CHECK (qty <> 0),   -- signed: + in, − out
  batch_id          UUID REFERENCES batches(id) ON DELETE SET NULL,
  phase_log_id      UUID REFERENCES phase_logs(id) ON DELETE SET NULL,   -- the cutting completion that consumed
  reason            TEXT,
  actor_user_id     UUID REFERENCES users(id),
  actor_worker_id   UUID REFERENCES workers(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT material_movements_variant_fkey
    FOREIGN KEY (variant_id, material_type_id) REFERENCES material_variants (id, material_type_id),
  CONSTRAINT material_movements_sign CHECK (
       (kind IN ('receive', 'return') AND qty > 0)
    OR (kind IN ('consume', 'waste')  AND qty < 0)
    OR  kind = 'adjust'),
  CONSTRAINT material_movements_shortfall CHECK (lot_id IS NOT NULL OR kind = 'consume')
);
CREATE INDEX idx_movements_lot   ON material_movements (lot_id, created_at) WHERE lot_id IS NOT NULL;
CREATE INDEX idx_movements_batch ON material_movements (batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX idx_movements_phase_log ON material_movements (phase_log_id) WHERE phase_log_id IS NOT NULL;
CREATE INDEX idx_movements_type  ON material_movements (material_type_id, created_at DESC);

-- Opening balance so the ledger matches today's numbers: receive the full roll, adjust down to what's left.
INSERT INTO material_movements (lot_id, material_type_id, variant_id, kind, qty, reason, created_at)
SELECT id, material_type_id, variant_id, 'receive', qty_received, 'opening balance (migration 015)', received_at
FROM material_lots WHERE qty_received > 0;
INSERT INTO material_movements (lot_id, material_type_id, variant_id, kind, qty, reason)
SELECT id, material_type_id, variant_id, 'adjust', qty_remaining - qty_received, 'opening balance (migration 015)'
FROM material_lots WHERE qty_remaining <> qty_received;

-- ───── consumption groups (recipe key, with product line) ─────
CREATE TABLE consumption_groups (
  id                SERIAL PRIMARY KEY,
  name              TEXT NOT NULL,
  sort              INT NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  default_for_size  car_size UNIQUE,   -- new cars of this size_class land here unless a group is given
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX uq_consumption_groups_name ON consumption_groups (lower(name));
INSERT INTO consumption_groups (name, sort, default_for_size) VALUES
  ('Small', 10, 'small'), ('Medium', 20, 'medium'), ('Large', 30, 'large');

ALTER TABLE car_models ADD COLUMN consumption_group_id INT REFERENCES consumption_groups(id);
UPDATE car_models cm SET consumption_group_id = g.id
FROM consumption_groups g WHERE g.default_for_size = cm.size_class;
ALTER TABLE car_models ALTER COLUMN consumption_group_id SET NOT NULL;

CREATE OR REPLACE FUNCTION car_models_default_consumption_group() RETURNS trigger AS $$
BEGIN
  IF NEW.consumption_group_id IS NULL THEN
    SELECT id INTO NEW.consumption_group_id FROM consumption_groups WHERE default_for_size = NEW.size_class;
  END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER car_models_default_consumption_group
  BEFORE INSERT ON car_models
  FOR EACH ROW EXECUTE FUNCTION car_models_default_consumption_group();

-- ───── recipes ─────
CREATE TABLE recipes (
  id                    SERIAL PRIMARY KEY,
  product_line_id       INT NOT NULL REFERENCES product_lines(id),
  consumption_group_id  INT NOT NULL REFERENCES consumption_groups(id),
  note                  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (product_line_id, consumption_group_id)
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON recipes
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TABLE recipe_lines (
  id                SERIAL PRIMARY KEY,
  recipe_id         INT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  material_type_id  INT NOT NULL REFERENCES material_types(id),
  variant_id        INT,                                     -- NULL = default / any variant
  qty_per_mat       NUMERIC(12,3) NOT NULL CHECK (qty_per_mat > 0),
  CONSTRAINT recipe_lines_variant_fkey
    FOREIGN KEY (variant_id, material_type_id) REFERENCES material_variants (id, material_type_id)
);
CREATE UNIQUE INDEX uq_recipe_lines ON recipe_lines (recipe_id, material_type_id, (COALESCE(variant_id, 0)));

CREATE TABLE car_material_overrides (
  id                SERIAL PRIMARY KEY,
  car_model_id      INT NOT NULL REFERENCES car_models(id) ON DELETE CASCADE,
  material_type_id  INT NOT NULL REFERENCES material_types(id),
  variant_id        INT,                                     -- NULL = any variant
  qty_per_mat       NUMERIC(12,3) NOT NULL CHECK (qty_per_mat >= 0),   -- 0 = "this car doesn't use it"
  CONSTRAINT car_material_overrides_variant_fkey
    FOREIGN KEY (variant_id, material_type_id) REFERENCES material_variants (id, material_type_id)
);
CREATE UNIQUE INDEX uq_car_material_overrides
  ON car_material_overrides (car_model_id, material_type_id, (COALESCE(variant_id, 0)));

-- ───── plan snapshot per consumption (feeds R2 planned vs actual) ─────
CREATE TABLE batch_material_plan (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id          UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  phase_log_id      UUID REFERENCES phase_logs(id) ON DELETE SET NULL,   -- the cutting completion that consumed
  material_type_id  INT NOT NULL REFERENCES material_types(id),
  variant_id        INT,                                     -- variant the quantity was resolved for
  source            TEXT NOT NULL CHECK (source IN ('car_variant', 'car_any', 'recipe_variant', 'recipe_any', 'none')),
  qty_per_mat       NUMERIC(12,3) CHECK (qty_per_mat >= 0),
  mats              INT NOT NULL CHECK (mats > 0),
  planned_qty       NUMERIC(12,3) CHECK (planned_qty >= 0),
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT batch_material_plan_variant_fkey
    FOREIGN KEY (variant_id, material_type_id) REFERENCES material_variants (id, material_type_id),
  CONSTRAINT batch_material_plan_none CHECK ((source = 'none') = (qty_per_mat IS NULL AND planned_qty IS NULL))
);
CREATE INDEX idx_batch_material_plan_batch ON batch_material_plan (batch_id);
-- One plan row per type per cutting completion: re-running consumption for a completion fails (no double deduction).
CREATE UNIQUE INDEX uq_plan_completion_type ON batch_material_plan (phase_log_id, material_type_id)
  WHERE phase_log_id IS NOT NULL;
