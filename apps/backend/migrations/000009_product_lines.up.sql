CREATE TABLE product_lines (
  id        SERIAL PRIMARY KEY,
  code      TEXT UNIQUE NOT NULL,     -- REX-R, REX-87, PVC-18, PVC-21
  name      TEXT NOT NULL,            -- 'Rexine (R)', 'PVC mat 1.8 mm'
  is_active BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO product_lines (code, name) VALUES
  ('REX-R','Rexine (R)'), ('REX-87','Rexine (87)'), ('PVC-18','PVC mat 1.8 mm'), ('PVC-21','PVC mat 2.1 mm');

-- one item = car + size + line; barcode (from 008) stays on this row
ALTER TABLE car_models ADD COLUMN product_line_id INT REFERENCES product_lines(id);
CREATE UNIQUE INDEX uq_car_models_item ON car_models (brand_id, lower(name), size_class, product_line_id);  