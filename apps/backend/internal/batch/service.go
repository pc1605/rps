package batch

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

var (
	ErrInvalidInput = errors.New("invalid input")
	ErrNotFound     = errors.New("batch not found")
)

type Service struct {
	pool *pgxpool.Pool
}

type Stats struct {
	InCutting      int `json:"in_cutting"`
	InStitching    int `json:"in_stitching"`
	InPacking      int `json:"in_packing"`
	CompletedToday int `json:"completed_today"`
	TotalActive    int `json:"total_active"`
	UnitsToday     int `json:"units_today"`
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// Create makes a batch + all its unit rows + an audit entry, atomically.
func (s *Service) Create(ctx context.Context, in CreateInput, actorID uuid.UUID, actorRole, ip string) (*Batch, error) {
	if in.CarModelID <= 0 || in.Quantity <= 0 {
		return nil, ErrInvalidInput
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx) // no-op if committed

	// 1. Validate car model exists
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM car_models WHERE id = $1)`, in.CarModelID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, fmt.Errorf("%w: car_model_id %d does not exist", ErrInvalidInput, in.CarModelID)
	}

	// 2. Optional roll validation
	var rollID *uuid.UUID
	if in.RollID != nil && *in.RollID != "" {
		parsed, err := uuid.Parse(*in.RollID)
		if err != nil {
			return nil, fmt.Errorf("%w: bad roll_id", ErrInvalidInput)
		}
		var rollExists bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM raw_materials WHERE id = $1 AND is_active)`, parsed).Scan(&rollExists); err != nil {
			return nil, err
		}
		if !rollExists {
			return nil, fmt.Errorf("%w: roll not found or inactive", ErrInvalidInput)
		}
		rollID = &parsed
	}

	// 3. Generate batch code atomically
	var batchCode string
	if err := tx.QueryRow(ctx, `SELECT next_batch_code()`).Scan(&batchCode); err != nil {
		return nil, err
	}

	// 4. Insert batch
	var b Batch
	err = tx.QueryRow(ctx, `
		INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, notes, created_by)
		VALUES ($1, $2, $3, $4, NULLIF($5,''), $6)
		RETURNING id, batch_code, car_model_id, roll_id, quantity,
		          current_phase, status, COALESCE(notes,''), rework_count,
		          created_by, version, created_at, updated_at
	`, batchCode, in.CarModelID, rollID, in.Quantity, in.Notes, actorID).Scan(
		&b.ID, &b.BatchCode, &b.CarModelID, &b.RollID, &b.Quantity,
		&b.CurrentPhase, &b.Status, &b.Notes, &b.ReworkCount,
		&b.CreatedBy, &b.Version, &b.CreatedAt, &b.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert batch: %w", err)
	}

	// 5. Insert N units in one statement (Hard Rule #18)
	_, err = tx.Exec(ctx, `
		INSERT INTO batch_units (batch_id, unit_code, unit_number)
		SELECT $1, $2 || '-' || LPAD(n::TEXT, 3, '0'), n
		FROM generate_series(1, $3) AS n
	`, b.ID, b.BatchCode, in.Quantity)
	if err != nil {
		return nil, fmt.Errorf("insert units: %w", err)
	}

	// 6. Audit (same tx — Hard Rule #16)
if err := audit.Write(ctx, tx, audit.Entry{
		ActorID:    actorID.String(),
		ActorRole:  actorRole,
		EntityType: "batch",
		EntityID:   b.ID.String(),
		Action:     audit.ActionCreate,
		After:      b,
		IP:         ip,
	}); err != nil {
		return nil, fmt.Errorf("audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	b.UnitsTotal = in.Quantity
	b.UnitsPacked = 0
	return &b, nil
}

// List returns batches with display fields + unit roll-up, newest first.
func (s *Service) List(ctx context.Context) ([]Batch, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT b.id, b.batch_code, b.car_model_id,
		       cb.name, cm.name, cm.size_class::text,
		       b.roll_id, rm.roll_code,
		       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
		       b.rework_count, b.created_by, u.name,
		       b.version, b.created_at, b.updated_at,
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id) AS units_total,
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'packed') AS units_packed
		FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		JOIN users u       ON u.id = b.created_by
		LEFT JOIN raw_materials rm ON rm.id = b.roll_id
		ORDER BY b.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Batch
	for rows.Next() {
		var b Batch
		if err := rows.Scan(
			&b.ID, &b.BatchCode, &b.CarModelID,
			&b.BrandName, &b.ModelName, &b.SizeClass,
			&b.RollID, &b.RollCode,
			&b.Quantity, &b.CurrentPhase, &b.Status, &b.Notes,
			&b.ReworkCount, &b.CreatedBy, &b.CreatedByName,
			&b.Version, &b.CreatedAt, &b.UpdatedAt,
			&b.UnitsTotal, &b.UnitsPacked,
		); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// Get returns one batch with its units.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (*BatchDetail, error) {
	var b Batch
	err := s.pool.QueryRow(ctx, `
		SELECT b.id, b.batch_code, b.car_model_id,
		       cb.name, cm.name, cm.size_class::text,
		       b.roll_id, rm.roll_code,
		       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
		       b.rework_count, b.created_by, u.name,
		       b.version, b.created_at, b.updated_at
		FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		JOIN users u       ON u.id = b.created_by
		LEFT JOIN raw_materials rm ON rm.id = b.roll_id
		WHERE b.id = $1
	`, id).Scan(
		&b.ID, &b.BatchCode, &b.CarModelID,
		&b.BrandName, &b.ModelName, &b.SizeClass,
		&b.RollID, &b.RollCode,
		&b.Quantity, &b.CurrentPhase, &b.Status, &b.Notes,
		&b.ReworkCount, &b.CreatedBy, &b.CreatedByName,
		&b.Version, &b.CreatedAt, &b.UpdatedAt,
	)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, batch_id, unit_code, unit_number, status, packed_at, created_at
		FROM batch_units WHERE batch_id = $1 ORDER BY unit_number
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	detail := &BatchDetail{Batch: b}
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.BatchID, &u.UnitCode, &u.UnitNumber, &u.Status, &u.PackedAt, &u.CreatedAt); err != nil {
			return nil, err
		}
		detail.Units = append(detail.Units, u)
		detail.UnitsTotal++
		if u.Status == UnitPacked {
			detail.UnitsPacked++
		}
	}
	return detail, rows.Err()
}

func (s *Service) GetStats(ctx context.Context) (*Stats, error) {
	var st Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  COUNT(*) FILTER (WHERE status != 'completed' AND current_phase = 'cutting'),
		  COUNT(*) FILTER (WHERE status != 'completed' AND current_phase = 'stitching'),
		  COUNT(*) FILTER (WHERE status != 'completed' AND current_phase = 'packing'),
		  COUNT(*) FILTER (WHERE status = 'completed' AND updated_at::date = CURRENT_DATE),
		  COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))
		FROM batches
	`).Scan(&st.InCutting, &st.InStitching, &st.InPacking, &st.CompletedToday, &st.TotalActive)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// ListByPhase returns active batches sitting at one phase, oldest first,
// including the open claim (who's working on it) if any.
// This powers the worker home screen: "what's waiting at my station."
func (s *Service) ListByPhase(ctx context.Context, phase Phase) ([]Batch, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT b.id, b.batch_code, b.car_model_id,
		       cb.name, cm.name, cm.size_class::text,
		       b.roll_id, rm.roll_code,
		       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
		       b.rework_count, b.created_by, u.name,
		       b.version, b.created_at, b.updated_at,
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'packed'),
		       pl.worker_id, wk.name
		FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		JOIN users u       ON u.id = b.created_by
		LEFT JOIN raw_materials rm ON rm.id = b.roll_id
		LEFT JOIN phase_logs pl ON pl.batch_id = b.id
		     AND pl.phase = b.current_phase
		     AND pl.completed_at IS NULL
		LEFT JOIN workers wk ON wk.id = pl.worker_id
		WHERE b.current_phase = $1
		  AND b.status IN ('pending', 'in_progress')
		ORDER BY b.created_at ASC
	`, phase)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Batch
	for rows.Next() {
		var b Batch
		if err := rows.Scan(
			&b.ID, &b.BatchCode, &b.CarModelID,
			&b.BrandName, &b.ModelName, &b.SizeClass,
			&b.RollID, &b.RollCode,
			&b.Quantity, &b.CurrentPhase, &b.Status, &b.Notes,
			&b.ReworkCount, &b.CreatedBy, &b.CreatedByName,
			&b.Version, &b.CreatedAt, &b.UpdatedAt,
			&b.UnitsTotal, &b.UnitsPacked,
			&b.ActiveWorkerID, &b.ActiveWorkerName,
		); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

var (
	ErrWrongPhase     = errors.New("batch is not at your station")
	ErrAlreadyStarted = errors.New("batch already started")
	ErrNotStarted     = errors.New("batch has not been started")
	ErrNotYours       = errors.New("batch was started by another worker")
)

// nextPhase defines the ONLY legal forward path through production.
func nextPhase(p Phase) (Phase, Status) {
	switch p {
	case PhaseCutting:
		return PhaseStitching, StatusPending
	case PhaseStitching:
		return PhasePacking, StatusPending
	case PhasePacking:
		return PhaseCompleted, StatusCompleted
	}
	return p, StatusCompleted
}

// StartPhase claims a batch for a worker at their station (Rule: exclusive claim).
func (s *Service) StartPhase(ctx context.Context, batchID, workerID uuid.UUID, station, ip string) error {
	phase, ok := PhaseForStation[station]
	if !ok {
		return fmt.Errorf("%w: unknown station", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var b struct {
		Phase   Phase
		Status  Status
		Code    string
	}
	err = tx.QueryRow(ctx,
		`SELECT current_phase, status, batch_code FROM batches WHERE id = $1 FOR UPDATE`,
		batchID).Scan(&b.Phase, &b.Status, &b.Code)
	if err == pgx.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if b.Phase != phase {
		return ErrWrongPhase
	}
	if b.Status != StatusPending {
		return ErrAlreadyStarted
	}

	// Atomic claim via the partial unique index.
	if _, err := tx.Exec(ctx,
		`INSERT INTO phase_logs (batch_id, phase, worker_id) VALUES ($1, $2, $3)`,
		batchID, phase, workerID); err != nil {
		return ErrAlreadyStarted // unique violation = raced by another worker
	}

	if _, err := tx.Exec(ctx,
		`UPDATE batches SET status = 'in_progress', version = version + 1 WHERE id = $1`,
		batchID); err != nil {
		return err
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: workerID.String(), ActorRole: station,
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		Before: map[string]any{"phase": b.Phase, "status": b.Status},
		After:  map[string]any{"phase": phase, "status": StatusInProgress, "event": "start"},
		IP:     ip,
	}); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// CompletePhase closes the worker's OWN open log and advances the batch.
func (s *Service) CompletePhase(ctx context.Context, batchID, workerID uuid.UUID, station string, quantityCompleted int, notes, ip string) error {
	phase, ok := PhaseForStation[station]
	if !ok {
		return fmt.Errorf("%w: unknown station", ErrInvalidInput)
	}
	if quantityCompleted < 0 {
		return fmt.Errorf("%w: quantity must be >= 0", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var cur struct {
		Phase  Phase
		Status Status
	}
	err = tx.QueryRow(ctx,
		`SELECT current_phase, status FROM batches WHERE id = $1 FOR UPDATE`,
		batchID).Scan(&cur.Phase, &cur.Status)
	if err == pgx.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if cur.Phase != phase {
		return ErrWrongPhase
	}
	if cur.Status != StatusInProgress {
		return ErrNotStarted
	}

	// Close MY open log — worker_id in the WHERE enforces the exclusive claim.
	ct, err := tx.Exec(ctx, `
		UPDATE phase_logs
		SET completed_at = NOW(), quantity_completed = $1, notes = NULLIF($2,'')
		WHERE batch_id = $3 AND phase = $4 AND completed_at IS NULL AND worker_id = $5
	`, quantityCompleted, notes, batchID, phase, workerID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotYours // an open log exists (status=in_progress) but isn't this worker's
	}

	next, newStatus := nextPhase(phase)
	if _, err := tx.Exec(ctx,
		`UPDATE batches SET current_phase = $1, status = $2, version = version + 1 WHERE id = $3`,
		next, newStatus, batchID); err != nil {
		return err
	}

	// Packing complete → mark all remaining units packed by this worker.
	// (Coarse bulk-mark; replaced by per-unit QR scanning in the labels slice.)
	if phase == PhasePacking {
		if _, err := tx.Exec(ctx, `
			UPDATE batch_units
			SET status = 'packed', packed_by = $1, packed_at = NOW()
			WHERE batch_id = $2 AND status = 'pending'
		`, workerID, batchID); err != nil {
			return err
		}
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: workerID.String(), ActorRole: station,
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		Before: map[string]any{"phase": phase, "status": cur.Status},
		After: map[string]any{"phase": next, "status": newStatus,
			"event": "complete", "quantity_completed": quantityCompleted},
		IP: ip,
	}); err != nil {
		return err
	}

	return tx.Commit(ctx)
}