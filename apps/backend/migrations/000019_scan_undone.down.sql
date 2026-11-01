-- 019 down: enum values can't be dropped without recreating the type; remove the rows that use it.
DELETE FROM batch_events WHERE kind::text = 'scan_undone';
