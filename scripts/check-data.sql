\echo '1. impossible phase/status combinations'
SELECT batch_code, current_phase, status FROM batches
WHERE NOT ( (current_phase='cutting'   AND status IN ('pending','in_progress','cancelled'))
         OR (current_phase='stitching' AND status IN ('awaiting_assignment','pending','in_progress'))
         OR (current_phase='packing'   AND status IN ('pending','in_progress'))
         OR (current_phase='completed' AND status='completed') );

\echo '2. unit count != batch quantity'
SELECT b.batch_code, b.quantity, COUNT(u.id) AS units FROM batches b LEFT JOIN batch_units u ON u.batch_id=b.id
GROUP BY b.id HAVING COUNT(u.id) <> b.quantity;

\echo '3. cut_qty out of range'
SELECT batch_code, cut_qty, quantity FROM batches WHERE cut_qty < 0 OR cut_qty > quantity
   OR (current_phase IN ('stitching','packing','completed') AND status <> 'awaiting_assignment' AND cut_qty <> quantity);

\echo '4. quotas that do not add up to quantity'
SELECT b.batch_code, b.quantity, SUM(a.target_qty) FROM batches b JOIN batch_assignments a ON a.batch_id=b.id AND a.phase='stitching'
WHERE a.target_qty IS NOT NULL GROUP BY b.id HAVING SUM(a.target_qty) <> b.quantity;

\echo '5. packed units missing who/when, or never stitched'
SELECT unit_code FROM batch_units WHERE status='packed' AND (packed_by IS NULL OR packed_at IS NULL OR stitched_at IS NULL);

\echo '6. completed batches with unfinished units'
SELECT b.batch_code, u.unit_code, u.status FROM batches b JOIN batch_units u ON u.batch_id=b.id
WHERE b.current_phase='completed' AND u.status NOT IN ('packed','defective','dispatched');

\echo '7. open rework rounds whose unit is not in rework'
SELECT r.id, u.unit_code, u.status FROM rework_logs r JOIN batch_units u ON u.id=r.unit_id
WHERE r.fixed_at IS NULL AND (r.decision IS NULL OR r.decision='to_stitcher') AND u.status <> 'rework';

\echo '8. units in rework without an open round'
SELECT u.unit_code FROM batch_units u WHERE u.status='rework' AND NOT EXISTS (
  SELECT 1 FROM rework_logs r WHERE r.unit_id=u.id AND r.fixed_at IS NULL AND (r.decision IS NULL OR r.decision='to_stitcher'));

\echo '9. more than one open cutting claim per batch'
SELECT batch_id, COUNT(*) FROM phase_logs WHERE phase='cutting' AND completed_at IS NULL GROUP BY batch_id HAVING COUNT(*) > 1;

\echo '10. cars without product line, duplicate barcodes'
SELECT name FROM car_models WHERE product_line_id IS NULL;
SELECT barcode, COUNT(*) FROM car_models WHERE barcode IS NOT NULL GROUP BY barcode HAVING COUNT(*) > 1;

\echo '11. batch code counter behind existing codes (next batch would collide)'
SELECT c.last_number, MAX(split_part(b.batch_code,'-',3)::int) AS max_used FROM batch_code_counters c, batches b
WHERE c.year = EXTRACT(YEAR FROM NOW()) GROUP BY c.last_number HAVING c.last_number < MAX(split_part(b.batch_code,'-',3)::int);

\echo '12. coverage — one row per state the demo should show'
SELECT current_phase, status, COUNT(*) FROM batches GROUP BY 1,2 ORDER BY 1,2;
SELECT status, COUNT(*) FROM batch_units GROUP BY 1 ORDER BY 1;
SELECT route, decision, (fixed_at IS NULL) AS open, COUNT(*) FROM rework_logs GROUP BY 1,2,3;
