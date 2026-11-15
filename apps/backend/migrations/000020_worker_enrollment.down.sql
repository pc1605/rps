-- 020 down: bring back badge_token (new random values — the old ones are gone) and drop the new columns.
ALTER TABLE workers ADD COLUMN badge_token TEXT;
UPDATE workers SET badge_token = 'BADGE-' || replace(uuid_generate_v4()::text, '-', '') || replace(uuid_generate_v4()::text, '-', '');
ALTER TABLE workers ALTER COLUMN badge_token SET NOT NULL;
ALTER TABLE workers ADD CONSTRAINT workers_badge_token_key UNIQUE (badge_token);
CREATE INDEX idx_workers_badge ON workers(badge_token) WHERE is_active = TRUE;

ALTER TABLE workers
  DROP COLUMN enroll_code_hash,
  DROP COLUMN enroll_expires_at,
  DROP COLUMN enroll_tries,
  DROP COLUMN session_no;
