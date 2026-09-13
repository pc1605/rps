ALTER TABLE batches DROP COLUMN stickers_printed_at;
DROP TABLE batch_assignments;
-- enum value 'awaiting_assignment' cannot be dropped in Postgres; harmless to leave.