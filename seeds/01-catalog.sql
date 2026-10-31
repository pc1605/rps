-- RPS · test catalog seed (flat items: one car_models row per car × line), real barcodes.
-- Requires migrations 008 (barcode) + 009 (product_lines). Idempotent.

BEGIN;

-- 1. Product lines
INSERT INTO product_lines (code, name) VALUES
  ('REX-R',  'Rexine (R)'),
  ('REX-87', 'Rexine (87)'),
  ('PVC-18', 'PVC mat 1.8 mm'),
  ('PVC-21', 'PVC mat 2.1 mm')
ON CONFLICT (code) DO NOTHING;

-- 2. Car brands
INSERT INTO car_brands (name)
SELECT b FROM (VALUES ('Maruti Suzuki'),('Hyundai'),('Tata'),('Mahindra'),('KIA'),('Renault')) AS v(b)
WHERE NOT EXISTS (SELECT 1 FROM car_brands cb WHERE lower(cb.name)=lower(v.b));

-- 3. Give existing seeded rows (no line yet) a default line so nothing is orphaned
UPDATE car_models SET product_line_id = (SELECT id FROM product_lines WHERE code='REX-R')
WHERE product_line_id IS NULL;

-- 5. Update existing car models to assign barcodes if matched by brand, model, size, and line
UPDATE car_models cm
SET barcode = v.barcode, pieces_per_set = v.pcs
FROM (VALUES
  ('Maruti Suzuki','Alto 800',   'small', 4,'REX-R', '38614660525'),
  ('Maruti Suzuki','Alto 800',   'small', 4,'REX-87','38665189413'),
  ('Maruti Suzuki','Alto 800',   'small', 4,'PVC-21','386527859'),
  ('Maruti Suzuki','Baleno',     'small', 4,'REX-R', '38634458938'),
  ('Maruti Suzuki','Baleno',     'small', 4,'REX-87','38640421677'),
  ('Maruti Suzuki','Swift 2018', 'small', 4,'REX-R', '38644023035'),
  ('Maruti Suzuki','Swift 2018', 'small', 4,'REX-87','38610840997'),
  ('Maruti Suzuki','Swift 2018', 'small', 4,'PVC-21','386387519'),
  ('Maruti Suzuki','Ertiga 2018','large', 7,'REX-R', '38672730282'),
  ('Maruti Suzuki','Ertiga 2018','large', 7,'REX-87','38675907527'),
  ('Hyundai',      'Creta 2020', 'medium',4,'REX-R', '38676801942'),
  ('Hyundai',      'Creta 2020', 'medium',4,'REX-87','3867211931'),
  ('Hyundai',      'i20 Elite',  'small', 4,'REX-R', '38619084604'),
  ('Hyundai',      'i20 Elite',  'small', 4,'REX-87','38680690634'),
  ('Hyundai',      'i20 Elite',  'small', 4,'PVC-21','386840751'),
  ('Hyundai',      'Venue',      'medium',4,'REX-R', '38634938112'),
  ('Hyundai',      'Venue',      'medium',4,'REX-87','38660124498'),
  ('Tata',         'Nexon',      'medium',4,'REX-R', '3861037859'),
  ('Tata',         'Nexon',      'medium',4,'REX-87','38616428865'),
  ('Tata',         'Nexon',      'medium',4,'PVC-21','386109047'),
  ('Tata',         'Punch',      'small', 4,'REX-R', '38697837817'),
  ('Tata',         'Punch',      'small', 4,'REX-87','38698315763'),
  ('Tata',         'Punch',      'small', 4,'PVC-21','386772761'),
  ('Mahindra',     'Scorpio',    'large', 7,'REX-R', '38628011571'),
  ('Mahindra',     'Scorpio',    'large', 7,'REX-87','38687013020'),
  ('KIA',          'Seltos',     'medium',4,'REX-R', '38688200963'),
  ('KIA',          'Seltos',     'medium',4,'REX-87','38610541711'),
  ('KIA',          'Seltos',     'medium',4,'PVC-21','386543014'),
  ('Renault',      'Kwid',       'small', 4,'REX-R', '38639905648'),
  ('Renault',      'Kwid',       'small', 4,'REX-87','38610330342'),
  ('Renault',      'Kwid',       'small', 4,'PVC-21','386788085')
) AS v(brand, model, size, pcs, line, barcode)
JOIN car_brands cb ON lower(cb.name)=lower(v.brand)
JOIN product_lines pl ON pl.code=v.line
WHERE cm.brand_id=cb.id 
  AND lower(cm.name)=lower(v.model) 
  AND cm.size_class=v.size::text::car_size 
  AND cm.product_line_id=pl.id
  AND (cm.barcode IS NULL OR cm.barcode <> v.barcode);

-- 6. Insert new items from 31 catalogue items if not present
INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, barcode)
SELECT cb.id, v.model, v.size::text::car_size, v.pcs, pl.id, v.barcode
FROM (VALUES
  ('Maruti Suzuki','Alto 800',   'small', 4,'REX-R', '38614660525'),
  ('Maruti Suzuki','Alto 800',   'small', 4,'REX-87','38665189413'),
  ('Maruti Suzuki','Alto 800',   'small', 4,'PVC-21','386527859'),
  ('Maruti Suzuki','Baleno',     'small', 4,'REX-R', '38634458938'),
  ('Maruti Suzuki','Baleno',     'small', 4,'REX-87','38640421677'),
  ('Maruti Suzuki','Swift 2018', 'small', 4,'REX-R', '38644023035'),
  ('Maruti Suzuki','Swift 2018', 'small', 4,'REX-87','38610840997'),
  ('Maruti Suzuki','Swift 2018', 'small', 4,'PVC-21','386387519'),
  ('Maruti Suzuki','Ertiga 2018','large', 7,'REX-R', '38672730282'),
  ('Maruti Suzuki','Ertiga 2018','large', 7,'REX-87','38675907527'),
  ('Hyundai',      'Creta 2020', 'medium',4,'REX-R', '38676801942'),
  ('Hyundai',      'Creta 2020', 'medium',4,'REX-87','3867211931'),
  ('Hyundai',      'i20 Elite',  'small', 4,'REX-R', '38619084604'),
  ('Hyundai',      'i20 Elite',  'small', 4,'REX-87','38680690634'),
  ('Hyundai',      'i20 Elite',  'small', 4,'PVC-21','386840751'),
  ('Hyundai',      'Venue',      'medium',4,'REX-R', '38634938112'),
  ('Hyundai',      'Venue',      'medium',4,'REX-87','38660124498'),
  ('Tata',         'Nexon',      'medium',4,'REX-R', '3861037859'),
  ('Tata',         'Nexon',      'medium',4,'REX-87','38616428865'),
  ('Tata',         'Nexon',      'medium',4,'PVC-21','386109047'),
  ('Tata',         'Punch',      'small', 4,'REX-R', '38697837817'),
  ('Tata',         'Punch',      'small', 4,'REX-87','38698315763'),
  ('Tata',         'Punch',      'small', 4,'PVC-21','386772761'),
  ('Mahindra',     'Scorpio',    'large', 7,'REX-R', '38628011571'),
  ('Mahindra',     'Scorpio',    'large', 7,'REX-87','38687013020'),
  ('KIA',          'Seltos',     'medium',4,'REX-R', '38688200963'),
  ('KIA',          'Seltos',     'medium',4,'REX-87','38610541711'),
  ('KIA',          'Seltos',     'medium',4,'PVC-21','386543014'),
  ('Renault',      'Kwid',       'small', 4,'REX-R', '38639905648'),
  ('Renault',      'Kwid',       'small', 4,'REX-87','38610330342'),
  ('Renault',      'Kwid',       'small', 4,'PVC-21','386788085')
) AS v(brand, model, size, pcs, line, barcode)
JOIN car_brands cb ON lower(cb.name)=lower(v.brand)
JOIN product_lines pl ON pl.code=v.line
WHERE NOT EXISTS (
  SELECT 1 FROM car_models cm
  WHERE cm.brand_id=cb.id AND lower(cm.name)=lower(v.model) AND cm.size_class=v.size::text::car_size AND cm.product_line_id=pl.id
) AND NOT EXISTS (SELECT 1 FROM car_models WHERE barcode=v.barcode);

-- ═════════ 7–12. Materials (migration 015) — ALL QUANTITIES ARE PLACEHOLDERS ═════════
-- Replace with the owner's numbers before any real consumption. Recipes carry note 'PLACEHOLDER …'.
-- Groups are looked up by default_for_size (survives renames). Idempotent: ON CONFLICT DO NOTHING.

-- 7. Non-sheet material types (units are placeholders until the owner confirms)
INSERT INTO material_types (code, name, unit, has_variants, sort) VALUES
  ('PIPING', 'Piping',  'm',     FALSE, 50),
  ('VELCRO', 'Velcro',  'm',     FALSE, 60),
  ('THREAD', 'Thread',  'spool', FALSE, 70)
ON CONFLICT (code) DO NOTHING;

-- 8. Roll-width variants for the four sheet types
INSERT INTO material_variants (material_type_id, name, specs)
SELECT t.id, w.name, jsonb_build_object('width_in', w.inches)
FROM material_types t
CROSS JOIN (VALUES ('54″', 54), ('60″', 60), ('72″', 72)) AS w(name, inches)
WHERE t.code IN ('REX-R', 'REX-87', 'PVC-18', 'PVC-21')
ON CONFLICT (material_type_id, (lower(name))) DO NOTHING;

-- 9. One recipe per product line × consumption group
INSERT INTO recipes (product_line_id, consumption_group_id, note)
SELECT pl.id, g.id, 'PLACEHOLDER quantities — replace with owner numbers'
FROM product_lines pl
CROSS JOIN consumption_groups g
WHERE pl.code IN ('REX-R', 'REX-87', 'PVC-18', 'PVC-21') AND g.default_for_size IS NOT NULL
ON CONFLICT (product_line_id, consumption_group_id) DO NOTHING;

-- 10. Recipe lines. Sheet material = the type with the line's code; metres depend on roll width:
--     default (any width) = base, 54″ = base × 1.12, 60″ = base, 72″ = base × 0.88.
WITH base(size, sheet_m, piping_m, velcro_m, thread_spool) AS (VALUES
  ('small'::car_size,  1.60, 3.0, 0.30, 0.05),
  ('medium'::car_size, 1.90, 3.4, 0.30, 0.06),
  ('large'::car_size,  2.60, 4.2, 0.45, 0.08)
),
r AS (
  SELECT r.id AS recipe_id, pl.code AS line_code, b.*
  FROM recipes r
  JOIN product_lines pl     ON pl.id = r.product_line_id
  JOIN consumption_groups g ON g.id = r.consumption_group_id
  JOIN base b               ON b.size = g.default_for_size
)
INSERT INTO recipe_lines (recipe_id, material_type_id, variant_id, qty_per_mat)
SELECT r.recipe_id, t.id, NULL, r.sheet_m
  FROM r JOIN material_types t ON t.code = r.line_code
UNION ALL
SELECT r.recipe_id, t.id, v.id,
       ROUND(r.sheet_m * CASE (v.specs->>'width_in')::int WHEN 54 THEN 1.12 WHEN 72 THEN 0.88 ELSE 1 END, 2)
  FROM r JOIN material_types t ON t.code = r.line_code
         JOIN material_variants v ON v.material_type_id = t.id
UNION ALL
SELECT r.recipe_id, t.id, NULL, r.piping_m     FROM r JOIN material_types t ON t.code = 'PIPING'
UNION ALL
SELECT r.recipe_id, t.id, NULL, r.velcro_m     FROM r JOIN material_types t ON t.code = 'VELCRO'
UNION ALL
SELECT r.recipe_id, t.id, NULL, r.thread_spool FROM r JOIN material_types t ON t.code = 'THREAD'
ON CONFLICT (recipe_id, material_type_id, (COALESCE(variant_id, 0))) DO NOTHING;

-- 11. Example per-car overrides (PLACEHOLDER): a 7-seater needs more on 60″; Kwid uses no piping.
INSERT INTO car_material_overrides (car_model_id, material_type_id, variant_id, qty_per_mat)
SELECT cm.id, t.id, v.id, o.qty
FROM (VALUES ('Ertiga 2018', 'REX-R', 'REX-R', '60″', 2.90),
             ('Kwid',        'REX-R', 'PIPING', NULL,  0.00)) AS o(model, line, type_code, variant, qty)
JOIN car_models cm        ON lower(cm.name) = lower(o.model)
JOIN product_lines pl     ON pl.id = cm.product_line_id AND pl.code = o.line
JOIN material_types t     ON t.code = o.type_code
LEFT JOIN material_variants v ON v.material_type_id = t.id AND v.name = o.variant
WHERE o.variant IS NULL OR v.id IS NOT NULL
ON CONFLICT (car_model_id, material_type_id, (COALESCE(variant_id, 0))) DO NOTHING;

-- 12. Demo rolls get a width (only when unset, and only a variant of the lot's own type)
UPDATE material_lots l SET variant_id = v.id
FROM (VALUES ('R-001', '60″'), ('R-002', '54″'), ('R-003', '72″')) AS d(lot_code, variant)
JOIN material_variants v ON v.name = d.variant
WHERE l.lot_code = d.lot_code AND l.variant_id IS NULL AND v.material_type_id = l.material_type_id;

COMMIT;

SELECT cb.name brand, cm.name model, cm.size_class, pl.code line, cm.barcode
FROM car_models cm JOIN car_brands cb ON cb.id=cm.brand_id LEFT JOIN product_lines pl ON pl.id=cm.product_line_id
ORDER BY cb.name, cm.name, pl.code;
