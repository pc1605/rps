-- 015 down. Only lossless while no 015-era material data exists; refuses otherwise.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM material_movements WHERE kind IN ('consume', 'waste', 'return'))
     OR EXISTS (SELECT 1 FROM material_lots WHERE variant_id IS NOT NULL)
     OR EXISTS (SELECT 1 FROM material_lots l JOIN material_types t ON t.id = l.material_type_id
                WHERE t.code NOT IN ('REX-R', 'REX-87', 'PVC-18', 'PVC-21')) THEN
    RAISE EXCEPTION '015 down would lose material data (consumption ledger, lot variants or non-sheet lots). Remove it first.';
  END IF;
END $$;

DROP TABLE batch_material_plan;
DROP TABLE car_material_overrides;
DROP TABLE recipe_lines;
DROP TABLE recipes;

DROP TRIGGER car_models_default_consumption_group ON car_models;
DROP FUNCTION car_models_default_consumption_group();
ALTER TABLE car_models DROP COLUMN consumption_group_id;
DROP TABLE consumption_groups;

DROP TABLE material_movements;

DROP INDEX idx_lots_type;
ALTER TABLE material_lots
  DROP CONSTRAINT material_lots_variant_fkey,
  DROP COLUMN note,
  DROP COLUMN supplier,
  DROP COLUMN unit_cost,
  DROP COLUMN variant_id,
  DROP COLUMN material_type_id,
  ALTER COLUMN qty_received  TYPE NUMERIC(10,2),
  ALTER COLUMN qty_remaining TYPE NUMERIC(10,2);
ALTER TABLE material_lots RENAME CONSTRAINT material_lots_qty_remaining_check TO raw_materials_remaining_meters_check;
ALTER TABLE material_lots RENAME CONSTRAINT material_lots_qty_received_check TO raw_materials_total_meters_check;
ALTER TABLE material_lots RENAME CONSTRAINT material_lots_lot_code_key TO raw_materials_roll_code_key;
ALTER INDEX idx_lots_active RENAME TO idx_rolls_active;
ALTER INDEX material_lots_pkey RENAME TO raw_materials_pkey;
ALTER TABLE material_lots RENAME COLUMN qty_remaining TO remaining_meters;
ALTER TABLE material_lots RENAME COLUMN qty_received TO total_meters;
ALTER TABLE material_lots RENAME COLUMN lot_code TO roll_code;
ALTER TABLE material_lots RENAME TO raw_materials;

DROP TABLE material_variants;
DROP TABLE material_types;
DROP TYPE movement_kind;
DROP TYPE material_unit;
