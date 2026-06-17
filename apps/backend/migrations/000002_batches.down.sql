DROP FUNCTION IF EXISTS next_batch_code();
DROP TABLE IF EXISTS batch_code_counters;

DROP TABLE IF EXISTS batch_units;

DROP TRIGGER IF EXISTS set_batches_updated_at ON batches;
DROP TABLE IF EXISTS batches;
DROP TABLE IF EXISTS raw_materials;
DROP TABLE IF EXISTS car_models;
DROP TABLE IF EXISTS car_brands;

DROP TYPE IF EXISTS unit_status;
DROP TYPE IF EXISTS batch_status;
DROP TYPE IF EXISTS batch_phase;
DROP TYPE IF EXISTS car_size;