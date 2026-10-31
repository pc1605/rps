-- scripts/cleanup-test-junk.sql — remove rows left by DB-test runs that used a dev DB (before TEST_DATABASE_URL).
--
--   psql "$DATABASE_URL" -f scripts/cleanup-test-junk.sql               # dry run: prints counts, ROLLBACK
--   psql "$DATABASE_URL" -v commit=1 -f scripts/cleanup-test-junk.sql   # apply
--
-- Junk = car_models / consumption_groups named 'T %' (and the C1b fixtures' 'T1B %'), their batches (incl.
-- split / re-cut children), fixture product lines 'T1B-%', fixture material types ('T %' name, '<CODE>-<digits>'
-- code) with their variants and lots, and 'T-LEDGER-%' lots. Deleted in FK order. Where a junk batch drew from a
-- REAL lot, the quantity is given back first so lot qty_remaining = SUM(movements) still holds.
-- Not touched: audit_log rows, upload files, Postman leftovers ('PM %' workers, 'R-PM-%' rolls).

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE junk_cars   ON COMMIT DROP AS SELECT id FROM car_models WHERE name LIKE 'T %' OR name LIKE 'T1B %';
CREATE TEMP TABLE junk_groups ON COMMIT DROP AS SELECT id FROM consumption_groups WHERE name LIKE 'T %' OR name LIKE 'T1B %';
CREATE TEMP TABLE junk_lines  ON COMMIT DROP AS SELECT id FROM product_lines WHERE code LIKE 'T1B-%';
CREATE TEMP TABLE junk_types  ON COMMIT DROP AS
  SELECT id FROM material_types WHERE name LIKE 'T %' AND code ~ '-[0-9]{12,}$';
CREATE TEMP TABLE junk_lots   ON COMMIT DROP AS
  SELECT id FROM material_lots WHERE material_type_id IN (SELECT id FROM junk_types) OR lot_code LIKE 'T-LEDGER-%';
CREATE TEMP TABLE junk_batches ON COMMIT DROP AS
  WITH RECURSIVE b(id) AS (
    SELECT id FROM batches WHERE car_model_id IN (SELECT id FROM junk_cars)
    UNION
    SELECT c.id FROM batches c JOIN b ON c.parent_batch_id = b.id
  ) SELECT id FROM b;

\echo '== junk found'
SELECT (SELECT COUNT(*) FROM junk_cars)    AS cars,
       (SELECT COUNT(*) FROM junk_groups)  AS groups,
       (SELECT COUNT(*) FROM junk_lines)   AS product_lines,
       (SELECT COUNT(*) FROM junk_batches) AS batches,
       (SELECT COUNT(*) FROM junk_types)   AS material_types,
       (SELECT COUNT(*) FROM junk_lots)    AS lots,
       (SELECT COUNT(*) FROM material_movements WHERE batch_id IN (SELECT id FROM junk_batches)
                                          AND lot_id IS NOT NULL AND lot_id NOT IN (SELECT id FROM junk_lots)) AS draws_on_real_lots;

\echo '== real lots that get quantity back'
SELECT l.lot_code, l.qty_remaining AS before, l.qty_remaining - SUM(m.qty) AS after
FROM material_movements m JOIN material_lots l ON l.id = m.lot_id
WHERE m.batch_id IN (SELECT id FROM junk_batches) AND m.lot_id NOT IN (SELECT id FROM junk_lots)
GROUP BY l.id ORDER BY l.lot_code;

-- 1. Give back what junk batches drew from real lots, then drop all their movements (incl. shortfalls).
UPDATE material_lots l SET qty_remaining = l.qty_remaining - d.drawn
FROM (SELECT lot_id, SUM(qty) AS drawn FROM material_movements
      WHERE batch_id IN (SELECT id FROM junk_batches) AND lot_id IS NOT NULL
        AND lot_id NOT IN (SELECT id FROM junk_lots)
      GROUP BY lot_id) d
WHERE l.id = d.lot_id;
DELETE FROM material_movements
WHERE batch_id IN (SELECT id FROM junk_batches)
   OR lot_id IN (SELECT id FROM junk_lots)
   OR material_type_id IN (SELECT id FROM junk_types);

-- 2. Batches (plan rows, units, logs, assignments, rework cascade). Unlink children first.
DELETE FROM batch_material_plan WHERE batch_id IN (SELECT id FROM junk_batches);
UPDATE batches SET parent_batch_id = NULL WHERE id IN (SELECT id FROM junk_batches);
DELETE FROM batches WHERE id IN (SELECT id FROM junk_batches);

-- 3. Cars (overrides cascade), recipes on junk groups/lines (lines cascade), groups, product lines.
DELETE FROM car_models WHERE id IN (SELECT id FROM junk_cars);
DELETE FROM recipes WHERE consumption_group_id IN (SELECT id FROM junk_groups)
                       OR product_line_id IN (SELECT id FROM junk_lines);
DELETE FROM consumption_groups WHERE id IN (SELECT id FROM junk_groups);
DELETE FROM product_lines WHERE id IN (SELECT id FROM junk_lines);

-- 4. Fixture materials: overrides / recipe lines on junk types, lots, variants, types.
DELETE FROM car_material_overrides WHERE material_type_id IN (SELECT id FROM junk_types);
DELETE FROM recipe_lines WHERE material_type_id IN (SELECT id FROM junk_types);
DELETE FROM material_lots WHERE id IN (SELECT id FROM junk_lots);
DELETE FROM material_variants WHERE material_type_id IN (SELECT id FROM junk_types);
DELETE FROM material_types WHERE id IN (SELECT id FROM junk_types);

\echo '== after: remaining junk (all must be 0) and ledger drift (must be 0)'
SELECT (SELECT COUNT(*) FROM car_models WHERE name LIKE 'T %' OR name LIKE 'T1B %') AS cars,
       (SELECT COUNT(*) FROM consumption_groups WHERE name LIKE 'T %' OR name LIKE 'T1B %') AS groups,
       (SELECT COUNT(*) FROM batches WHERE id IN (SELECT id FROM junk_batches)) AS batches,
       (SELECT COUNT(*) FROM material_types WHERE id IN (SELECT id FROM junk_types)) AS material_types,
       (SELECT COUNT(*) FROM (
          SELECT l.id FROM material_lots l LEFT JOIN material_movements m ON m.lot_id = l.id
          GROUP BY l.id HAVING l.qty_remaining <> COALESCE(SUM(m.qty), 0)) x) AS ledger_drift;

\if :{?commit}
  \if :commit
    COMMIT;
    \echo 'COMMITTED.'
  \else
    ROLLBACK;
    \echo 'ROLLED BACK (dry run). Re-run with -v commit=1 to apply.'
  \endif
\else
  ROLLBACK;
  \echo 'ROLLED BACK (dry run). Re-run with -v commit=1 to apply.'
\endif
