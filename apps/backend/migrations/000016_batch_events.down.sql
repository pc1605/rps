-- 016 down: drops the typed history (audit_log still has the raw rows).
DROP FUNCTION IF EXISTS backfill_batch_events();
DROP TABLE IF EXISTS app_settings;
DROP TABLE IF EXISTS batch_events;
DROP TYPE IF EXISTS batch_event_kind;
