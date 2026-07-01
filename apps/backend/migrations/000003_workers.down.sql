ALTER TABLE batch_units DROP CONSTRAINT IF EXISTS fk_batch_units_packed_by;

DROP TRIGGER IF EXISTS set_workers_updated_at ON workers;
DROP TABLE IF EXISTS workers;
DROP TYPE IF EXISTS worker_station;