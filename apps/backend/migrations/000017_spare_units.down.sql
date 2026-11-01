-- 017 down: enum value 'spare' on unit_status cannot be removed without recreating the type.
-- Spare mats are turned into written-off (defective) ones so nothing references the value.
UPDATE batch_units SET status = 'defective' WHERE status = 'spare';
