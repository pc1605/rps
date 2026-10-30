-- ============================================================================
-- RPS · Demo Seed Data (Slices A & B: Workflow, Multi-Worker, Short-Cut, Rework)
-- ============================================================================
-- Prerequisites:
-- This script expects a clean PostgreSQL database with migrations 001–012 applied
-- followed by the base catalog seed:
--   1. migrate -path apps/backend/migrations -database "$DATABASE_URL" up
--   2. (cd apps/backend && go run ./cmd/seed)
--   3. psql "$DATABASE_URL" -f demo-seed.sql
--   4. ./scripts/seed-uploads.sh
--
-- Idempotency:
-- Looks up existing users, workers, brands, and models by name, inserting them
-- if not present. Batches use standard B-YYYY-NNN format and handle re-runs cleanly.
--
-- Authentication:
-- Workers: Ramesh (cutter), Surya (stitcher), Mahesh (stitcher), Raju (packer).
-- PIN for all workers is 1234, hashed using bcrypt cost 10:
--   $2a$10$WWPbbNHUxC/RVAbmAGUiZ.O58GavfF2Jr/SEiLcj/AzjQVG2vSme.
-- ============================================================================

DO $$
DECLARE
  v_owner_id    UUID;
  v_ramesh_id   UUID;
  v_surya_id    UUID;
  v_mahesh_id   UUID;
  v_raju_id     UUID;
  v_roll_id     UUID;
  v_line_rex_r  INT;
  v_line_pvc    INT;
  v_baleno_id   INT;
  v_creta_id    INT;
  v_nexon_id    INT;
  v_ertiga_id   INT;
  v_swift_id    INT;

  v_b1_id       UUID;
  v_b2_id       UUID;
  v_b3_id       UUID;
  v_b4_id       UUID;
  v_b5_id       UUID;
  v_b6_id       UUID;
  v_b7_id       UUID;

  v_u_id        UUID;
  v_rework_id   UUID;
  v_yr          INT := EXTRACT(YEAR FROM NOW())::INT;
BEGIN

  -- 1. Owner Account Lookup / Fallback
  SELECT id INTO v_owner_id FROM users WHERE role = 'owner' LIMIT 1;
  IF v_owner_id IS NULL THEN
    INSERT INTO users (name, email, password_hash, role)
    VALUES ('Owner', 'owner@ambika.local', '$2a$10$VdOhbBcMkTPQMg0VRqnJr.RpCLBhkmQHebevBWW44YPmOpYSYPBpG', 'owner')
    RETURNING id INTO v_owner_id;
  END IF;

  -- 2. Workers (Ramesh, Surya, Mahesh, Raju)
  -- PIN 1234 bcrypt cost 10: $2a$10$WWPbbNHUxC/RVAbmAGUiZ.O58GavfF2Jr/SEiLcj/AzjQVG2vSme.
  SELECT id INTO v_ramesh_id FROM workers WHERE name = 'Ramesh' AND station = 'cutter' LIMIT 1;
  IF v_ramesh_id IS NULL THEN
    INSERT INTO workers (name, phone, station, badge_token, pin_hash, created_by)
    VALUES ('Ramesh', '9876543210', 'cutter', 'BADGE-ramesh-cutter', '$2a$10$WWPbbNHUxC/RVAbmAGUiZ.O58GavfF2Jr/SEiLcj/AzjQVG2vSme.', v_owner_id)
    RETURNING id INTO v_ramesh_id;
  END IF;

  SELECT id INTO v_surya_id FROM workers WHERE name = 'Surya' AND station = 'stitcher' LIMIT 1;
  IF v_surya_id IS NULL THEN
    INSERT INTO workers (name, phone, station, badge_token, pin_hash, created_by)
    VALUES ('Surya', '9876543211', 'stitcher', 'BADGE-surya-stitcher', '$2a$10$WWPbbNHUxC/RVAbmAGUiZ.O58GavfF2Jr/SEiLcj/AzjQVG2vSme.', v_owner_id)
    RETURNING id INTO v_surya_id;
  END IF;

  SELECT id INTO v_mahesh_id FROM workers WHERE name = 'Mahesh' AND station = 'stitcher' LIMIT 1;
  IF v_mahesh_id IS NULL THEN
    INSERT INTO workers (name, phone, station, badge_token, pin_hash, created_by)
    VALUES ('Mahesh', '9876543212', 'stitcher', 'BADGE-mahesh-stitcher', '$2a$10$WWPbbNHUxC/RVAbmAGUiZ.O58GavfF2Jr/SEiLcj/AzjQVG2vSme.', v_owner_id)
    RETURNING id INTO v_mahesh_id;
  END IF;

  SELECT id INTO v_raju_id FROM workers WHERE name = 'Raju' AND station = 'packer' LIMIT 1;
  IF v_raju_id IS NULL THEN
    INSERT INTO workers (name, phone, station, badge_token, pin_hash, created_by)
    VALUES ('Raju', '9876543213', 'packer', 'BADGE-raju-packer', '$2a$10$WWPbbNHUxC/RVAbmAGUiZ.O58GavfF2Jr/SEiLcj/AzjQVG2vSme.', v_owner_id)
    RETURNING id INTO v_raju_id;
  END IF;

  -- 3. Product lines and Rexine Rolls
  SELECT id INTO v_line_rex_r FROM product_lines WHERE code = 'REX-R' LIMIT 1;
  SELECT id INTO v_line_pvc FROM product_lines WHERE code = 'PVC-18' LIMIT 1;

  SELECT id INTO v_roll_id FROM raw_materials WHERE roll_code = 'R-001' LIMIT 1;
  IF v_roll_id IS NULL THEN
    INSERT INTO raw_materials (roll_code, color, total_meters, remaining_meters)
    VALUES ('R-001', 'Jet Black', 50.0, 40.0)
    RETURNING id INTO v_roll_id;
  END IF;

  -- 4. Car Models
  SELECT id INTO v_baleno_id FROM car_models WHERE name = 'Baleno' LIMIT 1;
  SELECT id INTO v_creta_id  FROM car_models WHERE name = 'Creta' LIMIT 1;
  SELECT id INTO v_nexon_id  FROM car_models WHERE name = 'Nexon' LIMIT 1;
  SELECT id INTO v_ertiga_id FROM car_models WHERE name = 'Ertiga' LIMIT 1;
  SELECT id INTO v_swift_id  FROM car_models WHERE name = 'Swift' LIMIT 1;

  -- Ensure product lines attached
  UPDATE car_models SET product_line_id = v_line_rex_r WHERE id IN (v_baleno_id, v_creta_id, v_swift_id) AND product_line_id IS NULL;
  UPDATE car_models SET product_line_id = v_line_pvc WHERE id IN (v_nexon_id, v_ertiga_id) AND product_line_id IS NULL;

  -- Clean out previous demo seed batches if present to keep rerun idempotent
  DELETE FROM batches WHERE batch_code IN ('B-2026-001','B-2026-002','B-2026-003','B-2026-004','B-2026-005','B-2026-006','B-2026-007');

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 1: Pending Cutting (Qty 4)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, created_by, created_at, updated_at)
  VALUES ('B-2026-001', v_baleno_id, v_roll_id, 4, 0, 'cutting', 'pending', v_owner_id, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours')
  RETURNING id INTO v_b1_id;

  FOR i IN 1..4 LOOP
    INSERT INTO batch_units (batch_id, unit_code, unit_number, status, created_at)
    VALUES (v_b1_id, 'B-2026-001-' || LPAD(i::TEXT, 3, '0'), i, 'pending', NOW() - INTERVAL '4 hours');
  END LOOP;

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 2: Awaiting Assignment with Short Cut (cut_qty 4 < quantity 6)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, notes, created_by, created_at, updated_at)
  VALUES ('B-2026-002', v_swift_id, v_roll_id, 6, 4, 'cutting', 'awaiting_assignment', 'Roll ended early; short cut by 2 units', v_owner_id, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '3 hours')
  RETURNING id INTO v_b2_id;

  FOR i IN 1..6 LOOP
    INSERT INTO batch_units (batch_id, unit_code, unit_number, status, created_at)
    VALUES (v_b2_id, 'B-2026-002-' || LPAD(i::TEXT, 3, '0'), i, 'pending', NOW() - INTERVAL '5 hours');
  END LOOP;

  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed, notes)
  VALUES (v_b2_id, 'cutting', v_ramesh_id, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 4, 'Roll exhausted');

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 3: Stitching In-Progress with Quotas (Surya 4 / Mahesh 2, partial scans)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, created_by, created_at, updated_at)
  VALUES ('B-2026-003', v_creta_id, v_roll_id, 6, 6, 'stitching', 'in_progress', v_owner_id, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour')
  RETURNING id INTO v_b3_id;

  INSERT INTO batch_assignments (batch_id, phase, worker_id, target_qty, assigned_by, created_at)
  VALUES 
    (v_b3_id, 'stitching', v_surya_id, 4, v_owner_id, NOW() - INTERVAL '2 hours'),
    (v_b3_id, 'stitching', v_mahesh_id, 2, v_owner_id, NOW() - INTERVAL '2 hours');

  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed)
  VALUES (v_b3_id, 'cutting', v_ramesh_id, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 6);

  -- Open phase logs for stitchers
  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at)
  VALUES 
    (v_b3_id, 'stitching', v_surya_id, NOW() - INTERVAL '90 minutes'),
    (v_b3_id, 'stitching', v_mahesh_id, NOW() - INTERVAL '60 minutes');

  -- Units: Surya scanned 2/4; Mahesh scanned 1/2; remaining 3 units pending
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, created_at)
  VALUES
    (v_b3_id, 'B-2026-003-001', 1, 'pending', v_surya_id, NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '3 hours'),
    (v_b3_id, 'B-2026-003-002', 2, 'pending', v_surya_id, NOW() - INTERVAL '35 minutes', NOW() - INTERVAL '3 hours'),
    (v_b3_id, 'B-2026-003-003', 3, 'pending', NULL, NULL, NOW() - INTERVAL '3 hours'),
    (v_b3_id, 'B-2026-003-004', 4, 'pending', NULL, NULL, NOW() - INTERVAL '3 hours'),
    (v_b3_id, 'B-2026-003-005', 5, 'pending', v_mahesh_id, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '3 hours'),
    (v_b3_id, 'B-2026-003-006', 6, 'pending', NULL, NULL, NOW() - INTERVAL '3 hours');

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 4: Packing In-Progress with Rework (1 routed to stitcher, 1 to admin)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, rework_count, created_by, created_at, updated_at)
  VALUES ('B-2026-004', v_nexon_id, v_roll_id, 5, 5, 'packing', 'in_progress', 2, v_owner_id, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '30 minutes')
  RETURNING id INTO v_b4_id;

  INSERT INTO batch_assignments (batch_id, phase, worker_id, target_qty, assigned_by, created_at)
  VALUES 
    (v_b4_id, 'stitching', v_surya_id, 5, v_owner_id, NOW() - INTERVAL '3 hours'),
    (v_b4_id, 'packing', v_raju_id, 5, v_owner_id, NOW() - INTERVAL '1 hour');

  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed)
  VALUES 
    (v_b4_id, 'cutting', v_ramesh_id, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '3 hours', 5),
    (v_b4_id, 'stitching', v_surya_id, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '1 hour', 5);

  -- Open packing log for Raju
  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at)
  VALUES (v_b4_id, 'packing', v_raju_id, NOW() - INTERVAL '45 minutes');

  -- Unit 1: Packed
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, packed_by, packed_at, created_at)
  VALUES (v_b4_id, 'B-2026-004-001', 1, 'packed', v_surya_id, NOW() - INTERVAL '2 hours', v_raju_id, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '4 hours');

  -- Unit 2: In Rework routed to Stitcher (round 1, stitching_fault)
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, created_at)
  VALUES (v_b4_id, 'B-2026-004-002', 2, 'rework', v_surya_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours')
  RETURNING id INTO v_u_id;

  INSERT INTO rework_logs (id, unit_id, batch_id, round, reasons, note, route, flagged_by, flagged_at)
  VALUES (gen_random_uuid(), v_u_id, v_b4_id, 1, ARRAY['stitching_fault'], 'Loose edge binding on left mat', 'stitcher', v_raju_id, NOW() - INTERVAL '20 minutes')
  RETURNING id INTO v_rework_id;

  INSERT INTO rework_photos (rework_id, path, created_at)
  VALUES (v_rework_id, 'seed-placeholder.jpg', NOW() - INTERVAL '20 minutes');

  -- Unit 3: In Rework routed to Admin (round 1, cutting_fault)
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, created_at)
  VALUES (v_b4_id, 'B-2026-004-003', 3, 'rework', v_surya_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours')
  RETURNING id INTO v_u_id;

  INSERT INTO rework_logs (id, unit_id, batch_id, round, reasons, note, route, flagged_by, flagged_at)
  VALUES (gen_random_uuid(), v_u_id, v_b4_id, 1, ARRAY['cutting_fault'], 'Asymmetric cut along border', 'admin', v_raju_id, NOW() - INTERVAL '15 minutes')
  RETURNING id INTO v_rework_id;

  INSERT INTO rework_photos (rework_id, path, created_at)
  VALUES (v_rework_id, 'seed-placeholder.jpg', NOW() - INTERVAL '15 minutes');

  -- Unit 4 & 5: Pending packing
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, created_at)
  VALUES 
    (v_b4_id, 'B-2026-004-004', 4, 'pending', v_surya_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours'),
    (v_b4_id, 'B-2026-004-005', 5, 'pending', v_surya_id, NOW() - INTERVAL '2 hours', NOW() - INTERVAL '4 hours');

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 5: Batch with One Written-Off Unit (defective + closed round)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, rework_count, created_by, created_at, updated_at)
  VALUES ('B-2026-005', v_ertiga_id, v_roll_id, 4, 4, 'packing', 'in_progress', 1, v_owner_id, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '1 hour')
  RETURNING id INTO v_b5_id;

  INSERT INTO batch_assignments (batch_id, phase, worker_id, target_qty, assigned_by, created_at)
  VALUES 
    (v_b5_id, 'stitching', v_mahesh_id, 4, v_owner_id, NOW() - INTERVAL '4 hours'),
    (v_b5_id, 'packing', v_raju_id, 4, v_owner_id, NOW() - INTERVAL '2 hours');

  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed)
  VALUES 
    (v_b5_id, 'cutting', v_ramesh_id, NOW() - INTERVAL '5 hours', NOW() - INTERVAL '4 hours', 4),
    (v_b5_id, 'stitching', v_mahesh_id, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '2 hours', 4),
    (v_b5_id, 'packing', v_raju_id, NOW() - INTERVAL '2 hours', NULL, NULL);

  -- Unit 1: Packed
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, packed_by, packed_at, created_at)
  VALUES (v_b5_id, 'B-2026-005-001', 1, 'packed', v_mahesh_id, NOW() - INTERVAL '3 hours', v_raju_id, NOW() - INTERVAL '90 minutes', NOW() - INTERVAL '5 hours');

  -- Unit 2: Defective (written off by admin)
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, created_at)
  VALUES (v_b5_id, 'B-2026-005-002', 2, 'defective', v_mahesh_id, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '5 hours')
  RETURNING id INTO v_u_id;

  INSERT INTO rework_logs (id, unit_id, batch_id, round, reasons, note, route, flagged_by, flagged_at, decision, decided_by, decided_at)
  VALUES (gen_random_uuid(), v_u_id, v_b5_id, 1, ARRAY['material_defect'], 'Deep tear in rexine backing', 'admin', v_raju_id, NOW() - INTERVAL '100 minutes', 'write_off', v_owner_id, NOW() - INTERVAL '80 minutes')
  RETURNING id INTO v_rework_id;

  INSERT INTO rework_photos (rework_id, path, created_at)
  VALUES (v_rework_id, 'seed-placeholder.jpg', NOW() - INTERVAL '100 minutes');

  -- Units 3 & 4: Pending packing
  INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, created_at)
  VALUES 
    (v_b5_id, 'B-2026-005-003', 3, 'pending', v_mahesh_id, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '5 hours'),
    (v_b5_id, 'B-2026-005-004', 4, 'pending', v_mahesh_id, NOW() - INTERVAL '3 hours', NOW() - INTERVAL '5 hours');

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 6: Completed Batch Yesterday (for reports)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, created_by, created_at, updated_at)
  VALUES ('B-2026-006', v_baleno_id, v_roll_id, 5, 5, 'completed', 'completed', v_owner_id, NOW() - INTERVAL '28 hours', NOW() - INTERVAL '20 hours')
  RETURNING id INTO v_b6_id;

  INSERT INTO batch_assignments (batch_id, phase, worker_id, target_qty, assigned_by, created_at)
  VALUES 
    (v_b6_id, 'stitching', v_surya_id, 5, v_owner_id, NOW() - INTERVAL '26 hours'),
    (v_b6_id, 'packing', v_raju_id, 5, v_owner_id, NOW() - INTERVAL '23 hours');

  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed)
  VALUES 
    (v_b6_id, 'cutting', v_ramesh_id, NOW() - INTERVAL '28 hours', NOW() - INTERVAL '26 hours', 5),
    (v_b6_id, 'stitching', v_surya_id, NOW() - INTERVAL '26 hours', NOW() - INTERVAL '23 hours', 5),
    (v_b6_id, 'packing', v_raju_id, NOW() - INTERVAL '23 hours', NOW() - INTERVAL '20 hours', 5);

  FOR i IN 1..5 LOOP
    INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, packed_by, packed_at, created_at)
    VALUES (v_b6_id, 'B-2026-006-' || LPAD(i::TEXT, 3, '0'), i, 'packed', v_surya_id, NOW() - INTERVAL '24 hours', v_raju_id, NOW() - INTERVAL '21 hours', NOW() - INTERVAL '28 hours');
  END LOOP;

  -- ────────────────────────────────────────────────────────────────────────────
  -- BATCH 7: Completed Batch Last Week (for reports)
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, cut_qty, current_phase, status, created_by, created_at, updated_at)
  VALUES ('B-2026-007', v_creta_id, v_roll_id, 8, 8, 'completed', 'completed', v_owner_id, NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days')
  RETURNING id INTO v_b7_id;

  INSERT INTO batch_assignments (batch_id, phase, worker_id, target_qty, assigned_by, created_at)
  VALUES 
    (v_b7_id, 'stitching', v_mahesh_id, 8, v_owner_id, NOW() - INTERVAL '7 days'),
    (v_b7_id, 'packing', v_raju_id, 8, v_owner_id, NOW() - INTERVAL '6 days 18 hours');

  INSERT INTO phase_logs (batch_id, phase, worker_id, started_at, completed_at, quantity_completed)
  VALUES 
    (v_b7_id, 'cutting', v_ramesh_id, NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days 20 hours', 8),
    (v_b7_id, 'stitching', v_mahesh_id, NOW() - INTERVAL '6 days 20 hours', NOW() - INTERVAL '6 days 16 hours', 8),
    (v_b7_id, 'packing', v_raju_id, NOW() - INTERVAL '6 days 16 hours', NOW() - INTERVAL '6 days 12 hours', 8);

  FOR i IN 1..8 LOOP
    INSERT INTO batch_units (batch_id, unit_code, unit_number, status, stitched_by, stitched_at, packed_by, packed_at, created_at)
    VALUES (v_b7_id, 'B-2026-007-' || LPAD(i::TEXT, 3, '0'), i, 'packed', v_mahesh_id, NOW() - INTERVAL '6 days 18 hours', v_raju_id, NOW() - INTERVAL '6 days 14 hours', NOW() - INTERVAL '7 days');
  END LOOP;

  -- ────────────────────────────────────────────────────────────────────────────
  -- 5. Batch Code Counter Update
  -- ────────────────────────────────────────────────────────────────────────────
  INSERT INTO batch_code_counters (year, last_number)
  VALUES (v_yr, 7)
  ON CONFLICT (year)
  DO UPDATE SET last_number = GREATEST(batch_code_counters.last_number, 7);

END $$;
