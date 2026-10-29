-- 000012_rework.up.sql
ALTER TYPE unit_status ADD VALUE IF NOT EXISTS 'rework';

CREATE TABLE rework_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    unit_id UUID NOT NULL REFERENCES batch_units(id) ON DELETE CASCADE,
    batch_id UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
    round INT NOT NULL,
    reasons TEXT[] NOT NULL,
    note TEXT,
    route TEXT NOT NULL CHECK (route IN ('stitcher', 'admin')),
    flagged_by UUID NOT NULL REFERENCES workers(id),
    flagged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    decision TEXT CHECK (decision IN ('to_stitcher', 'recut', 'write_off')),
    decided_by UUID REFERENCES users(id),
    decided_at TIMESTAMPTZ,
    fixed_by UUID REFERENCES workers(id),
    fixed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX uq_rework_open ON rework_logs(unit_id) WHERE fixed_at IS NULL AND (decision IS NULL OR decision = 'to_stitcher');

CREATE TABLE rework_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rework_id UUID NOT NULL REFERENCES rework_logs(id) ON DELETE CASCADE,
    path TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
