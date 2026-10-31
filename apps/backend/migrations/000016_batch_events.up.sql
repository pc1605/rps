-- 016: typed batch history (audit E1) + app settings (stuck thresholds).
-- Every batch transition writes one row in the same tx as the change. Rows rebuilt from older data
-- carry data->>'backfill' = 'true' (timestamps approximate where noted).

CREATE TYPE batch_event_kind AS ENUM (
  'created', 'cut_started', 'cut_completed', 'short_resolved', 'assigned',
  'stitching_started', 'stitching_completed', 'packing_started', 'completed',
  'cancelled', 'edited', 'claim_released'   -- the last three are written from U3 on
);

CREATE TABLE batch_events (
  id               BIGSERIAL PRIMARY KEY,
  batch_id         UUID NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  kind             batch_event_kind NOT NULL,
  from_phase       batch_phase,
  to_phase         batch_phase,
  from_status      batch_status,
  to_status        batch_status,
  actor_user_id    UUID REFERENCES users(id),
  actor_worker_id  UUID REFERENCES workers(id),
  data             JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX idx_batch_events_batch ON batch_events (batch_id, at);
CREATE INDEX idx_batch_events_kind  ON batch_events (kind, at);

CREATE TABLE app_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES users(id)
);
-- "Stuck" = no event and no scan for this many hours in the batch's current phase/status.
INSERT INTO app_settings (key, value) VALUES
  ('stuck_hours', '{"cutting": 24, "awaiting_assignment": 24, "stitching": 48, "packing": 48}');

-- ───── backfill ─────

-- created (remainders / re-cuts keep their parent)
INSERT INTO batch_events (batch_id, at, kind, to_phase, to_status, actor_user_id, data)
SELECT b.id, b.created_at, 'created', 'cutting', 'pending', b.created_by,
       jsonb_strip_nulls(jsonb_build_object('backfill', true, 'quantity', b.quantity, 'parent', b.parent_batch_id))
FROM batches b;

-- cutting: one start + one completion per cutting log
INSERT INTO batch_events (batch_id, at, kind, from_phase, to_phase, to_status, actor_worker_id, data)
SELECT pl.batch_id, pl.started_at, 'cut_started', 'cutting', 'cutting', 'in_progress', pl.worker_id, '{"backfill": true}'
FROM phase_logs pl WHERE pl.phase = 'cutting';

-- (every cut completion parks the batch in stitching / awaiting_assignment)
INSERT INTO batch_events (batch_id, at, kind, from_phase, to_phase, to_status, actor_worker_id, data)
SELECT pl.batch_id, pl.completed_at, 'cut_completed', 'cutting', 'stitching', 'awaiting_assignment', pl.worker_id,
       jsonb_build_object('backfill', true, 'cut', pl.quantity_completed)
FROM phase_logs pl WHERE pl.phase = 'cutting' AND pl.completed_at IS NOT NULL;

-- short-cut resolutions and assignment saves, from the audit log
INSERT INTO batch_events (batch_id, at, kind, actor_user_id, data)
SELECT a.entity_id::uuid, a.created_at, 'short_resolved', a.actor_id,
       jsonb_strip_nulls(jsonb_build_object('backfill', true,
         'action', substring(a.after_json->>'event' FROM 11),
         'reason', NULLIF(a.after_json->>'reason', ''),
         'remainder', NULLIF(a.after_json->>'remainder', ''),
         'cut', a.after_json->'cut', 'quantity', a.after_json->'quantity'))
FROM audit_log a
WHERE a.entity_type = 'batch' AND a.after_json->>'event' LIKE 'short\_cut\_%'
  AND EXISTS (SELECT 1 FROM batches b WHERE b.id::text = a.entity_id);

INSERT INTO batch_events (batch_id, at, kind, actor_user_id, data)
SELECT a.entity_id::uuid, a.created_at, 'assigned', a.actor_id,
       jsonb_build_object('backfill', true, 'phase', a.after_json->'phase', 'workers', a.after_json->'workers')
FROM audit_log a
WHERE a.entity_type = 'batch' AND a.after_json->>'event' = 'assignments_set'
  AND EXISTS (SELECT 1 FROM batches b WHERE b.id::text = a.entity_id);

-- stitching / packing: first and last scan
INSERT INTO batch_events (batch_id, at, kind, from_phase, to_phase, to_status, data)
SELECT bu.batch_id, MIN(bu.stitched_at), 'stitching_started', 'stitching', 'stitching', 'in_progress', '{"backfill": true}'
FROM batch_units bu WHERE bu.stitched_at IS NOT NULL GROUP BY bu.batch_id;

INSERT INTO batch_events (batch_id, at, kind, from_phase, to_phase, to_status, data)
SELECT bu.batch_id, MAX(bu.stitched_at), 'stitching_completed', 'stitching', 'packing', 'pending', '{"backfill": true}'
FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
WHERE bu.stitched_at IS NOT NULL AND b.current_phase IN ('packing', 'completed')
GROUP BY bu.batch_id;

INSERT INTO batch_events (batch_id, at, kind, from_phase, to_phase, to_status, data)
SELECT bu.batch_id, MIN(bu.packed_at), 'packing_started', 'packing', 'packing', 'in_progress', '{"backfill": true}'
FROM batch_units bu WHERE bu.packed_at IS NOT NULL GROUP BY bu.batch_id;

-- completed: last pack scan (or last update when nothing was packed, e.g. all written off)
INSERT INTO batch_events (batch_id, at, kind, from_phase, to_phase, to_status, data)
SELECT b.id, COALESCE((SELECT MAX(bu.packed_at) FROM batch_units bu WHERE bu.batch_id = b.id), b.updated_at),
       'completed', 'packing', 'completed', 'completed', '{"backfill": true}'
FROM batches b WHERE b.status = 'completed';
