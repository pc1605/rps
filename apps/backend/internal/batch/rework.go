package batch

import (
	"context"
	"errors"
	"fmt"
	"path/filepath"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/pc1605/rps/apps/backend/internal/audit"
)

var allowedReasons = map[string]bool{
	"stitching_fault": true,
	"stain":           true,
	"cutting_fault":   true,
	"material_defect": true,
	"other":           true,
}

func validateReasons(reasons []string) error {
	if len(reasons) == 0 {
		return errors.New("at least one reason is required")
	}
	for _, r := range reasons {
		if !allowedReasons[r] {
			return fmt.Errorf("invalid reason: %s", r)
		}
	}
	return nil
}

// routeFor determines whether rework routes to admin or the original stitcher.
func routeFor(round int, reasons []string, hasStitcher bool) string {
	if round >= 2 {
		return "admin"
	}
	for _, r := range reasons {
		if r == "cutting_fault" || r == "material_defect" {
			return "admin"
		}
	}
	if !hasStitcher {
		return "admin"
	}
	return "stitcher"
}

// completePackingIfDone advances the batch to completed if all units are packed or defective.
func completePackingIfDone(ctx context.Context, tx pgx.Tx, batchID uuid.UUID) (bool, error) {
	var currentPhase Phase
	var status Status
	err := tx.QueryRow(ctx, `SELECT current_phase, status FROM batches WHERE id = $1 FOR UPDATE`, batchID).Scan(&currentPhase, &status)
	if err != nil {
		return false, err
	}
	if currentPhase != PhasePacking || status != StatusInProgress {
		return false, nil
	}

	var total, done int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*), COUNT(*) FILTER (WHERE status IN ('packed', 'defective', 'dispatched'))
		FROM batch_units WHERE batch_id = $1
	`, batchID).Scan(&total, &done)
	if err != nil {
		return false, err
	}
	if total == 0 || done < total {
		return false, nil
	}

	// Close all open packing phase logs with per-worker packed counts
	if _, err := tx.Exec(ctx, `
		UPDATE phase_logs pl
		SET completed_at = NOW(),
		    quantity_completed = (SELECT COUNT(*) FROM batch_units bu
		                          WHERE bu.batch_id=$1 AND bu.packed_by=pl.worker_id)
		WHERE pl.batch_id=$1 AND pl.phase='packing' AND pl.completed_at IS NULL
	`, batchID); err != nil {
		return false, err
	}

	// Advance batch to completed
	next, newStatus := nextPhase(PhasePacking)
	if _, err := tx.Exec(ctx, `
		UPDATE batches SET current_phase=$1, status=$2, version=version+1 WHERE id=$3
	`, next, newStatus, batchID); err != nil {
		return false, err
	}

	return true, nil
}

// FlagRework marks a mat for rework, creating a new round in rework_logs.
func (s *Service) FlagRework(ctx context.Context, unitCode string, workerID uuid.UUID, station string, reasons []string, note *string, photoPaths []string, ip string) (*ReworkEntry, error) {
	if station != "packer" {
		return nil, ErrWrongPhase
	}
	if err := validateReasons(reasons); err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalidInput, err)
	}
	if len(photoPaths) < 1 || len(photoPaths) > 3 {
		return nil, fmt.Errorf("%w: 1 to 3 photos required", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		unitID      uuid.UUID
		unitStatus  UnitStatus
		stitchedBy  *uuid.UUID
		batchID     uuid.UUID
		batchCode   string
		batchPhase  Phase
		batchStatus Status
	)
	err = tx.QueryRow(ctx, `
		SELECT bu.id, bu.status, bu.stitched_by, b.id, b.batch_code, b.current_phase, b.status
		FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
		WHERE bu.unit_code = $1 FOR UPDATE OF b, bu
	`, unitCode).Scan(&unitID, &unitStatus, &stitchedBy, &batchID, &batchCode, &batchPhase, &batchStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUnitNotFound
	}
	if err != nil {
		return nil, err
	}

	if batchPhase != PhasePacking {
		return nil, ErrWrongPhase
	}
	if batchStatus != StatusInProgress {
		return nil, ErrNotStarted
	}

	var joined bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM phase_logs WHERE batch_id=$1 AND phase='packing' AND worker_id=$2 AND completed_at IS NULL)
	`, batchID, workerID).Scan(&joined); err != nil {
		return nil, err
	}
	if !joined {
		return nil, ErrNotStarted
	}

	var openExists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM rework_logs WHERE unit_id = $1 AND fixed_at IS NULL AND (decision IS NULL OR decision = 'to_stitcher'))
	`, unitID).Scan(&openExists); err != nil {
		return nil, err
	}
	if openExists {
		return nil, ErrAlreadyInRework
	}

	if unitStatus != UnitPending {
		return nil, fmt.Errorf("%w: unit must be pending (currently %s)", ErrInvalidInput, unitStatus)
	}

	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM rework_logs WHERE unit_id = $1`, unitID).Scan(&count); err != nil {
		return nil, err
	}
	round := count + 1

	route := routeFor(round, reasons, stitchedBy != nil)
	reworkID := uuid.New()
	now := time.Now().UTC()

	if _, err := tx.Exec(ctx, `
		INSERT INTO rework_logs (id, unit_id, batch_id, round, reasons, note, route, flagged_by, flagged_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, reworkID, unitID, batchID, round, reasons, note, route, workerID, now); err != nil {
		return nil, err
	}

	photos := make([]ReworkPhoto, 0, len(photoPaths))
	for _, p := range photoPaths {
		filename := filepath.Base(p)
		photoID := uuid.New()
		if _, err := tx.Exec(ctx, `
			INSERT INTO rework_photos (id, rework_id, path) VALUES ($1, $2, $3)
		`, photoID, reworkID, filename); err != nil {
			return nil, err
		}
		photos = append(photos, ReworkPhoto{ID: photoID, URL: "/api/v1/files/rework/" + filename})
	}

	if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'rework' WHERE id = $1`, unitID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE batches SET rework_count = rework_count + 1, version = version + 1 WHERE id = $1`, batchID); err != nil {
		return nil, err
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID:    workerID.String(),
		ActorRole:  station,
		EntityType: "rework_log",
		EntityID:   reworkID.String(),
		Action:     audit.ActionTransition,
		After: map[string]any{
			"unit_code": unitCode,
			"event":     "rework_flagged",
			"round":     round,
			"route":     route,
			"reasons":   reasons,
		},
		IP: ip,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	var workerName string
	_ = s.pool.QueryRow(ctx, `SELECT name FROM workers WHERE id = $1`, workerID).Scan(&workerName)

	return &ReworkEntry{
		ID:            reworkID,
		UnitID:        unitID,
		UnitCode:      unitCode,
		BatchID:       batchID,
		BatchCode:     batchCode,
		Round:         round,
		Reasons:       reasons,
		Note:          note,
		Route:         route,
		FlaggedByName: workerName,
		FlaggedAt:     now,
		Photos:        photos,
	}, nil
}

// ListReworkForStitcher returns open rework items assigned to the stitcher, oldest first.
func (s *Service) ListReworkForStitcher(ctx context.Context, stitcherID uuid.UUID) ([]ReworkEntry, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT rl.id, rl.unit_id, bu.unit_code, rl.batch_id, b.batch_code,
		       cb.name, cm.name, cm.size_class::text, pl.name,
		       rl.round, rl.reasons, rl.note, rl.route,
		       w.name, rl.flagged_at,
		       rl.decision, rl.decided_at,
		       wf.name, rl.fixed_at
		FROM rework_logs rl
		JOIN batch_units bu ON bu.id = rl.unit_id
		JOIN batches b ON b.id = rl.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		JOIN workers w ON w.id = rl.flagged_by
		LEFT JOIN workers wf ON wf.id = rl.fixed_by
		WHERE rl.route = 'stitcher' AND rl.fixed_at IS NULL AND bu.stitched_by = $1
		ORDER BY rl.flagged_at ASC
	`, stitcherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*ReworkEntry
	for rows.Next() {
		var e ReworkEntry
		var fixedByName *string
		if err := rows.Scan(
			&e.ID, &e.UnitID, &e.UnitCode, &e.BatchID, &e.BatchCode,
			&e.BrandName, &e.ModelName, &e.SizeClass, &e.LineName,
			&e.Round, &e.Reasons, &e.Note, &e.Route,
			&e.FlaggedByName, &e.FlaggedAt,
			&e.Decision, &e.DecidedAt,
			&fixedByName, &e.FixedAt,
		); err != nil {
			return nil, err
		}
		e.FixedByName = fixedByName
		entries = append(entries, &e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := s.attachPhotos(ctx, entries); err != nil {
		return nil, err
	}
	out := make([]ReworkEntry, len(entries))
	for i, e := range entries {
		out[i] = *e
	}
	return out, nil
}

// ListRework returns rework entries for admin, newest first.
func (s *Service) ListRework(ctx context.Context, status string, route *string) ([]ReworkEntry, error) {
	query := `
		SELECT rl.id, rl.unit_id, bu.unit_code, rl.batch_id, b.batch_code,
		       cb.name, cm.name, cm.size_class::text, pl.name,
		       rl.round, rl.reasons, rl.note, rl.route,
		       w.name, rl.flagged_at,
		       rl.decision, rl.decided_at,
		       wf.name, rl.fixed_at
		FROM rework_logs rl
		JOIN batch_units bu ON bu.id = rl.unit_id
		JOIN batches b ON b.id = rl.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		JOIN workers w ON w.id = rl.flagged_by
		LEFT JOIN workers wf ON wf.id = rl.fixed_by
		WHERE 1=1
	`
	args := []any{}
	if status == "open" || status == "" {
		query += ` AND rl.fixed_at IS NULL AND (rl.decision IS NULL OR rl.decision = 'to_stitcher')`
	}
	if route != nil && *route != "" {
		args = append(args, *route)
		query += fmt.Sprintf(` AND rl.route = $%d`, len(args))
	}
	query += ` ORDER BY rl.flagged_at DESC`

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var entries []*ReworkEntry
	for rows.Next() {
		var e ReworkEntry
		var fixedByName *string
		if err := rows.Scan(
			&e.ID, &e.UnitID, &e.UnitCode, &e.BatchID, &e.BatchCode,
			&e.BrandName, &e.ModelName, &e.SizeClass, &e.LineName,
			&e.Round, &e.Reasons, &e.Note, &e.Route,
			&e.FlaggedByName, &e.FlaggedAt,
			&e.Decision, &e.DecidedAt,
			&fixedByName, &e.FixedAt,
		); err != nil {
			return nil, err
		}
		e.FixedByName = fixedByName
		entries = append(entries, &e)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if err := s.attachPhotos(ctx, entries); err != nil {
		return nil, err
	}
	out := make([]ReworkEntry, len(entries))
	for i, e := range entries {
		out[i] = *e
	}
	return out, nil
}

// DecideRework records an admin decision on an open rework round.
func (s *Service) DecideRework(ctx context.Context, reworkID uuid.UUID, decision string, note *string, adminID uuid.UUID, ip string) (*ReworkEntry, error) {
	if decision != "to_stitcher" && decision != "recut" && decision != "write_off" {
		return nil, fmt.Errorf("%w: decision must be to_stitcher, recut, or write_off", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		unitID        uuid.UUID
		batchID       uuid.UUID
		route         string
		currDecision  *string
		fixedAt       *time.Time
		round         int
		reasons       []string
		origNote      *string
		flaggedAt     time.Time
		flaggedByName string
		unitCode      string
		stitchedBy    *uuid.UUID
		batchCode     string
		carModelID    int
		rollID        *uuid.UUID
	)

	err = tx.QueryRow(ctx, `
		SELECT rl.unit_id, rl.batch_id, rl.route, rl.decision, rl.fixed_at,
		       rl.round, rl.reasons, rl.note, rl.flagged_at, w.name,
		       bu.unit_code, bu.stitched_by,
		       b.batch_code, b.car_model_id, b.roll_id
		FROM rework_logs rl
		JOIN batch_units bu ON bu.id = rl.unit_id
		JOIN batches b ON b.id = rl.batch_id
		JOIN workers w ON w.id = rl.flagged_by
		WHERE rl.id = $1 FOR UPDATE OF rl, bu, b
	`, reworkID).Scan(
		&unitID, &batchID, &route, &currDecision, &fixedAt,
		&round, &reasons, &origNote, &flaggedAt, &flaggedByName,
		&unitCode, &stitchedBy,
		&batchCode, &carModelID, &rollID,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Only open rounds with route='admin' and decision NULL
	if route != "admin" || currDecision != nil || fixedAt != nil {
		return nil, ErrReworkNotOpen
	}

	now := time.Now().UTC()
	var newBatchCode *string

	switch decision {
	case "to_stitcher":
		if stitchedBy == nil {
			return nil, fmt.Errorf("%w: cannot route to stitcher: unit has no stitched_by worker", ErrInvalidInput)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE rework_logs
			SET decision = 'to_stitcher', decided_by = $1, decided_at = $2, route = 'stitcher'
			WHERE id = $3
		`, adminID, now, reworkID); err != nil {
			return nil, err
		}
	case "write_off":
		if _, err := tx.Exec(ctx, `
			UPDATE rework_logs
			SET decision = 'write_off', decided_by = $1, decided_at = $2
			WHERE id = $3
		`, adminID, now, reworkID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'defective' WHERE id = $1`, unitID); err != nil {
			return nil, err
		}
		if _, err := completePackingIfDone(ctx, tx, batchID); err != nil {
			return nil, err
		}
	case "recut":
		if _, err := tx.Exec(ctx, `
			UPDATE rework_logs
			SET decision = 'recut', decided_by = $1, decided_at = $2
			WHERE id = $3
		`, adminID, now, reworkID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'defective' WHERE id = $1`, unitID); err != nil {
			return nil, err
		}
		var code string
		if err := tx.QueryRow(ctx, `SELECT next_batch_code()`).Scan(&code); err != nil {
			return nil, err
		}
		newBatchCode = &code
		batchNotes := fmt.Sprintf("Re-cut of %s (rework)", unitCode)
		if note != nil && *note != "" {
			batchNotes += " - " + *note
		}
		var newBatchID uuid.UUID
		if err := tx.QueryRow(ctx, `
			INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, notes, created_by, parent_batch_id)
			VALUES ($1, $2, $3, 1, $4, $5, $6) RETURNING id
		`, code, carModelID, rollID, batchNotes, adminID, batchID).Scan(&newBatchID); err != nil {
			return nil, fmt.Errorf("create recut batch: %w", err)
		}
		if _, err := tx.Exec(ctx, `
			INSERT INTO batch_units (batch_id, unit_code, unit_number)
			SELECT $1, $2 || '-' || LPAD(gs.n::TEXT, 3, '0'), gs.n FROM generate_series(1, 1) AS gs(n)
		`, newBatchID, code); err != nil {
			return nil, fmt.Errorf("create recut units: %w", err)
		}
		if _, err := completePackingIfDone(ctx, tx, batchID); err != nil {
			return nil, err
		}
	}

	auditAfter := map[string]any{
		"event":    "rework_decision",
		"decision": decision,
	}
	if newBatchCode != nil {
		auditAfter["new_batch_code"] = *newBatchCode
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID:    adminID.String(),
		ActorRole:  "admin",
		EntityType: "rework_log",
		EntityID:   reworkID.String(),
		Action:     audit.ActionTransition,
		After:      auditAfter,
		IP:         ip,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	updatedRoute := route
	if decision == "to_stitcher" {
		updatedRoute = "stitcher"
	}
	entry := &ReworkEntry{
		ID:            reworkID,
		UnitID:        unitID,
		UnitCode:      unitCode,
		BatchID:       batchID,
		BatchCode:     batchCode,
		Round:         round,
		Reasons:       reasons,
		Note:          origNote,
		Route:         updatedRoute,
		FlaggedByName: flaggedByName,
		FlaggedAt:     flaggedAt,
		Decision:      &decision,
		DecidedAt:     &now,
		NewBatchCode:  newBatchCode,
		Photos:        []ReworkPhoto{},
	}
	_ = s.attachPhotos(ctx, []*ReworkEntry{entry})
	return entry, nil
}

func (s *Service) attachPhotos(ctx context.Context, entries []*ReworkEntry) error {
	if len(entries) == 0 {
		return nil
	}
	reworkIDs := make([]uuid.UUID, len(entries))
	entryMap := make(map[uuid.UUID]*ReworkEntry, len(entries))
	for i, e := range entries {
		reworkIDs[i] = e.ID
		entryMap[e.ID] = e
		e.Photos = []ReworkPhoto{}
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, rework_id, path
		FROM rework_photos
		WHERE rework_id = ANY($1)
		ORDER BY created_at ASC
	`, reworkIDs)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var photoID, rwID uuid.UUID
		var path string
		if err := rows.Scan(&photoID, &rwID, &path); err != nil {
			return err
		}
		if entry, ok := entryMap[rwID]; ok {
			entry.Photos = append(entry.Photos, ReworkPhoto{
				ID:  photoID,
				URL: "/api/v1/files/rework/" + path,
			})
		}
	}
	return rows.Err()
}
