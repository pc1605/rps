-- ============================================================
-- RPS · Migration 020 · worker enrollment: one-time codes, one phone per worker
-- ============================================================
-- Before: a permanent badge_token (shown as QR + text) plus the PIN signed a phone in — anyone who
-- copied the code could reuse it forever. Now the admin makes a fresh code for one worker that works
-- once and expires after 10 minutes, so a phone can only be set up in front of the admin.

ALTER TABLE workers
  -- SHA-256 (hex) of the current enrollment code; NULL = no code waiting. Never store the code itself.
  ADD COLUMN enroll_code_hash  TEXT UNIQUE,
  ADD COLUMN enroll_expires_at TIMESTAMPTZ,
  -- Wrong-PIN tries against the current code; the code dies after 5.
  ADD COLUMN enroll_tries      SMALLINT NOT NULL DEFAULT 0,
  -- One phone per worker: every sign-in raises this, and a token is valid only while its number
  -- matches. Tokens issued before this migration carry no number (= 0) and keep working until the
  -- worker's next sign-in.
  ADD COLUMN session_no        INTEGER NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS idx_workers_badge;
ALTER TABLE workers DROP COLUMN badge_token;
