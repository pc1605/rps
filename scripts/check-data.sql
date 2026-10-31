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

-- ───── materials (migration 015) ─────
\echo '13. lot qty_remaining differs from the sum of its movements'
SELECT l.lot_code, l.qty_remaining, COALESCE(SUM(m.qty), 0) AS ledger
FROM material_lots l LEFT JOIN material_movements m ON m.lot_id = l.id
GROUP BY l.id HAVING l.qty_remaining <> COALESCE(SUM(m.qty), 0);

\echo '14. lot variant not of the lot''s type, or variant on a type without variants'
SELECT l.lot_code, t.code AS lot_type, v.name AS variant, vt.code AS variant_type
FROM material_lots l JOIN material_types t ON t.id = l.material_type_id
JOIN material_variants v ON v.id = l.variant_id JOIN material_types vt ON vt.id = v.material_type_id
WHERE v.material_type_id <> l.material_type_id OR NOT t.has_variants;

\echo '15. recipe-line / car-override variant not of the line''s type, or on a type without variants'
SELECT 'recipe_line' AS src, rl.id, t.code AS line_type, v.name AS variant
FROM recipe_lines rl JOIN material_types t ON t.id = rl.material_type_id JOIN material_variants v ON v.id = rl.variant_id
WHERE v.material_type_id <> rl.material_type_id OR NOT t.has_variants
UNION ALL
SELECT 'car_override', o.id, t.code, v.name
FROM car_material_overrides o JOIN material_types t ON t.id = o.material_type_id JOIN material_variants v ON v.id = o.variant_id
WHERE v.material_type_id <> o.material_type_id OR NOT t.has_variants;

\echo '16. movement type differs from its lot''s type'
SELECT m.id, l.lot_code, mt.code AS movement_type, lt.code AS lot_type
FROM material_movements m JOIN material_lots l ON l.id = m.lot_id
JOIN material_types mt ON mt.id = m.material_type_id JOIN material_types lt ON lt.id = l.material_type_id
WHERE m.material_type_id <> l.material_type_id;

\echo '17. WARNING (informational, may be non-empty): active cars with no recipe for their product line × consumption group — consumption would plan "none"'
SELECT cb.name AS brand, cm.name AS model, pl.code AS line, g.name AS grp
FROM car_models cm JOIN car_brands cb ON cb.id = cm.brand_id
JOIN product_lines pl ON pl.id = cm.product_line_id JOIN consumption_groups g ON g.id = cm.consumption_group_id
WHERE cm.is_active AND NOT EXISTS (
  SELECT 1 FROM recipes r WHERE r.product_line_id = cm.product_line_id AND r.consumption_group_id = cm.consumption_group_id);

\echo '18. coverage — materials'
SELECT t.code, t.unit, t.has_variants,
       (SELECT COUNT(*) FROM material_variants v WHERE v.material_type_id = t.id) AS variants,
       (SELECT COUNT(*) FROM material_lots l WHERE l.material_type_id = t.id) AS lots,
       (SELECT COALESCE(SUM(l.qty_remaining), 0) FROM material_lots l WHERE l.material_type_id = t.id AND l.is_active) AS remaining
FROM material_types t ORDER BY t.sort;
SELECT kind, COUNT(*) FROM material_movements GROUP BY 1 ORDER BY 1;
SELECT COUNT(*) AS recipes, (SELECT COUNT(*) FROM recipe_lines) AS lines,
       (SELECT COUNT(*) FROM car_material_overrides) AS overrides FROM recipes;
