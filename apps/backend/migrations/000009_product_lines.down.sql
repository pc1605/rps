DROP INDEX uq_car_models_item;
ALTER TABLE car_models DROP COLUMN product_line_id;
ALTER TABLE car_models ADD CONSTRAINT car_models_brand_id_name_key UNIQUE (brand_id, name);
DROP TABLE product_lines;