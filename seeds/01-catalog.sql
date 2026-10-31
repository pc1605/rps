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

-- 3. Drop legacy constraint if present (migration 009 established uq_car_models_item)
ALTER TABLE car_models DROP CONSTRAINT IF EXISTS car_models_brand_id_name_key;

-- 4. Give existing seeded rows (no line yet) a default line so nothing is orphaned
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

COMMIT;

SELECT cb.name brand, cm.name model, cm.size_class, pl.code line, cm.barcode
FROM car_models cm JOIN car_brands cb ON cb.id=cm.brand_id LEFT JOIN product_lines pl ON pl.id=cm.product_line_id
ORDER BY cb.name, cm.name, pl.code;
