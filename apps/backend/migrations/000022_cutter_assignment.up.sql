-- 022: cutters are assigned by the admin (D48). No cutter picks a batch on their own any more:
-- a batch in cutting with no cutter waits as cutting / awaiting_assignment ("Needs a cutter"), admin only.

-- A batch a cutter has already started: that cutter becomes its assigned cutter, so it stays in their queue.
INSERT INTO batch_assignments (batch_id, phase, worker_id, assigned_by)
SELECT b.id, 'cutting', pl.worker_id, b.created_by
FROM batches b
JOIN phase_logs pl ON pl.batch_id = b.id AND pl.phase = 'cutting' AND pl.completed_at IS NULL
WHERE b.current_phase = 'cutting' AND b.status = 'in_progress'
ON CONFLICT DO NOTHING;

-- Not started and nobody assigned: waits for the admin.
UPDATE batches b SET status = 'awaiting_assignment', version = version + 1
WHERE b.current_phase = 'cutting' AND b.status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM batch_assignments ba WHERE ba.batch_id = b.id AND ba.phase = 'cutting');
