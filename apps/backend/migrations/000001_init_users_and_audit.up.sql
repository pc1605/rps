-- ============================================================
-- RPS · Migration 001 · users + audit_log
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS citext;

-- ───── ENUMS ─────
CREATE TYPE user_role AS ENUM ('owner', 'supervisor');

CREATE TYPE audit_action AS ENUM (
  'create', 'update', 'delete', 'transition',
  'login', 'logout', 'failed_login'
);

-- ───── users ─────
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL CHECK (char_length(name) > 0),
  email           CITEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL CHECK (char_length(password_hash) >= 60),
  role            user_role NOT NULL,
  deactivated_at  TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email_active ON users (email) WHERE deactivated_at IS NULL;

-- ───── audit_log ─────
-- Every mutation across the system writes one row here, in the same
-- transaction as the change. This is RPS Hard Rule #16.
--
-- actor_id intentionally has NO foreign key constraint.
-- Audit rows must survive user deletion or deactivation.
-- actor_role captures who they were at the time of the action.
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  actor_id        UUID,
  actor_role      TEXT,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  action          audit_action NOT NULL,
  before_json     JSONB,
  after_json      JSONB,
  ip              INET,
  device          TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_entity  ON audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_actor   ON audit_log (actor_id);
CREATE INDEX idx_audit_created ON audit_log (created_at DESC);
CREATE INDEX idx_audit_action  ON audit_log (action);

-- ───── auto-update updated_at on row change ─────
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();