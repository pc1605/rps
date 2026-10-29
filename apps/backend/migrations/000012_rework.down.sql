-- 000012_rework.down.sql
DROP TABLE IF EXISTS rework_photos;
DROP TABLE IF EXISTS rework_logs;

-- Note: Enum value 'rework' on unit_status cannot be safely removed in PostgreSQL without recreating the type.
