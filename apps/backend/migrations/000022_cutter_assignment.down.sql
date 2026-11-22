-- Back to the open cutting queue. Cutting assignments are kept (they made batches private before 022 too).
UPDATE batches SET status = 'pending', version = version + 1
WHERE current_phase = 'cutting' AND status = 'awaiting_assignment';
