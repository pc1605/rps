package batch

import (
	"context"
	"errors"
	"fmt"
	"time"

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
	InCutting          int `json:"in_cutting"`
	InStitching        int `json:"in_stitching"`
	InPacking          int `json:"in_packing"`
	AwaitingAssignment int `json:"awaiting_assignment"`
	CompletedToday     int `json:"completed_today"`
	TotalActive        int `json:"total_active"`
	UnitsToday         int `json:"units_today"`
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
		FROM generate_series(1, $3) AS nErrNotAssigned
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
		       b.version, b.created_at, b.updated_at, b.stickers_printed_at,
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'packed'),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.stitched_at IS NOT NULL)
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
			&b.Version, &b.CreatedAt, &b.UpdatedAt, &b.StickersPrintedAt,
			&b.UnitsTotal, &b.UnitsPacked, &b.UnitsStitched,
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
		SELECT bu.id, bu.batch_id, bu.unit_code, bu.unit_number, bu.status,
		       bu.stitched_at, ws.name, bu.packed_at, wp.name, bu.created_at
		FROM batch_units bu
		LEFT JOIN workers ws ON ws.id = bu.stitched_by
		LEFT JOIN workers wp ON wp.id = bu.packed_by
		WHERE bu.batch_id = $1 ORDER BY bu.unit_number
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	detail := &BatchDetail{Batch: b}
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.BatchID, &u.UnitCode, &u.UnitNumber, &u.Status, &u.StitchedAt, &u.StitchedByName, &u.PackedAt, &u.PackedByName, &u.CreatedAt); err != nil {
			return nil, err
		}
		detail.Units = append(detail.Units, u)
		detail.UnitsTotal++
		if u.Status == UnitPacked {
			detail.UnitsPacked++
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Production timeline
	logRows, err := s.pool.Query(ctx, `
		SELECT pl.id, pl.phase, pl.worker_id, w.name,
		       pl.started_at, pl.completed_at,
		       EXTRACT(EPOCH FROM (pl.completed_at - pl.started_at))::int,
		       pl.quantity_completed, COALESCE(pl.notes,'')
		FROM phase_logs pl
		JOIN workers w ON w.id = pl.worker_id
		WHERE pl.batch_id = $1
		ORDER BY pl.started_at ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer logRows.Close()

	detail.Timeline = []PhaseLogEntry{}
	for logRows.Next() {
		var e PhaseLogEntry
		if err := logRows.Scan(&e.ID, &e.Phase, &e.WorkerID, &e.WorkerName,
			&e.StartedAt, &e.CompletedAt, &e.DurationSeconds,
			&e.QuantityCompleted, &e.Notes); err != nil {
			return nil, err
		}
		detail.Timeline = append(detail.Timeline, e)
	}
	if err := logRows.Err(); err != nil {
		return nil, err
	}
	// Assignments per phase
	aRows, err := s.pool.Query(ctx, `
			SELECT ba.phase, ba.worker_id, w.name, ba.target_qty,
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = ba.batch_id
		          AND ((ba.phase = 'stitching' AND bu.stitched_by = ba.worker_id)
		            OR (ba.phase = 'packing'   AND bu.packed_by   = ba.worker_id)))
		FROM batch_assignments ba JOIN workers w ON w.id = ba.worker_id
		WHERE ba.batch_id = $1 ORDER BY ba.phase, w.name
	`, id)
	if err != nil {
		return nil, err
	}
	defer aRows.Close()
	detail.Assignments = []AssignmentEntry{}
	for aRows.Next() {
		var a AssignmentEntry
		if err := aRows.Scan(&a.Phase, &a.WorkerID, &a.WorkerName, &a.TargetQty, &a.DoneQty); err != nil {
			return nil, err
		}
		detail.Assignments = append(detail.Assignments, a)
	}
	if err := aRows.Err(); err != nil {
		return nil, err
	}
	return detail, nil
}

func (s *Service) GetStats(ctx context.Context) (*Stats, error) {
	var st Stats
	err := s.pool.QueryRow(ctx, `
		SELECT
		  COUNT(*) FILTER (WHERE current_phase = 'cutting'   AND status IN ('pending','in_progress')),
		  COUNT(*) FILTER (WHERE current_phase = 'stitching' AND status = 'awaiting_assignment'),
		  COUNT(*) FILTER (WHERE current_phase = 'stitching' AND status IN ('pending','in_progress')),
		  COUNT(*) FILTER (WHERE current_phase = 'packing'   AND status IN ('pending','in_progress')),
		  COUNT(*) FILTER (WHERE status = 'completed' AND updated_at::date = CURRENT_DATE),
		  COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled'))
		FROM batches
	`).Scan(
		&st.InCutting,
		&st.AwaitingAssignment,
		&st.InStitching,
		&st.InPacking,
		&st.CompletedToday,
		&st.TotalActive,
	)
	if err != nil {
		return nil, err
	}
	return &st, nil
}

// ListByPhase returns batches at one phase for a worker's queue, oldest first.
// Visibility: a phase with no assignment is an open queue; a phase with
// assignments is visible only to its assignees. Carries who's working now,
// whether THIS worker joined/is assigned, and their quota + done count.
func (s *Service) ListByPhase(ctx context.Context, phase Phase, workerID uuid.UUID) ([]Batch, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT b.id, b.batch_code, b.car_model_id,
		       cb.name, cm.name, cm.size_class::text,
		       b.roll_id, rm.roll_code,
		       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
		       b.rework_count, b.created_by, u.name,
		       b.version, b.created_at, b.updated_at,
		       -- unit roll-ups
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'packed'),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.stitched_at IS NOT NULL),
		       -- who's working right now / did I join
		       (SELECT string_agg(wk.name, ', ' ORDER BY pl.started_at)
		        FROM phase_logs pl JOIN workers wk ON wk.id = pl.worker_id
		        WHERE pl.batch_id = b.id AND pl.phase = b.current_phase
		          AND pl.completed_at IS NULL),
		       EXISTS(SELECT 1 FROM phase_logs pl
		        WHERE pl.batch_id = b.id AND pl.phase = b.current_phase
		          AND pl.completed_at IS NULL AND pl.worker_id = $2),
		       -- assignment: names / am I assigned / my quota / my done count
		       (SELECT string_agg(wk.name, ', ' ORDER BY wk.name)
		        FROM batch_assignments ba JOIN workers wk ON wk.id = ba.worker_id
		        WHERE ba.batch_id = b.id AND ba.phase = b.current_phase),
		       EXISTS(SELECT 1 FROM batch_assignments ba
		        WHERE ba.batch_id = b.id AND ba.phase = b.current_phase
		          AND ba.worker_id = $2),
		       (SELECT ba.target_qty FROM batch_assignments ba
		        WHERE ba.batch_id = b.id AND ba.phase = b.current_phase
		          AND ba.worker_id = $2),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id
		          AND ((b.current_phase = 'stitching' AND bu.stitched_by = $2)
		            OR (b.current_phase = 'packing'   AND bu.packed_by   = $2)))
		FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		JOIN users u       ON u.id = b.created_by
		LEFT JOIN raw_materials rm ON rm.id = b.roll_id
		WHERE b.current_phase = $1
		  AND b.status IN ('pending', 'in_progress')
		  AND (
		    NOT EXISTS (SELECT 1 FROM batch_assignments ba
		                WHERE ba.batch_id = b.id AND ba.phase = b.current_phase)
		    OR EXISTS (SELECT 1 FROM batch_assignments ba
		               WHERE ba.batch_id = b.id AND ba.phase = b.current_phase
		                 AND ba.worker_id = $2)
		  )
		ORDER BY EXISTS(SELECT 1 FROM batch_assignments ba
		           WHERE ba.batch_id = b.id AND ba.phase = b.current_phase
		             AND ba.worker_id = $2) DESC,
		         b.created_at ASC
	`, phase, workerID)
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
			&b.UnitsTotal, &b.UnitsPacked, &b.UnitsStitched,
			&b.ActiveWorkers, &b.JoinedByMe,
			&b.AssignedWorkers, &b.AssignedToMe,
			&b.MyTargetQty, &b.MyDoneQty,
		); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

var (
	ErrWrongPhase     = errors.New("this batch is not at your station right now")
	ErrAlreadyStarted = errors.New("this batch has already been started")
	ErrNotStarted     = errors.New("this batch is not active yet — start or join it first")
	ErrNotYours       = errors.New("this batch was started by another worker")
	ErrNotAssigned    = errors.New("this batch is assigned to other workers")
	ErrQuotaReached   = errors.New("your share of this batch is complete")
)

// nextPhase defines the ONLY legal forward path through production.
func nextPhase(p Phase) (Phase, Status) {
	switch p {
	case PhaseCutting:
		return PhaseStitching, StatusAwaitingAssignment
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
		Phase  Phase
		Status Status
		Code   string
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

	// Assignment gate: if this phase has assignees, only they may start/join.
	var assigned, isMine bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM batch_assignments WHERE batch_id=$1 AND phase=$2),
		       EXISTS(SELECT 1 FROM batch_assignments WHERE batch_id=$1 AND phase=$2 AND worker_id=$3)
	`, batchID, phase, workerID).Scan(&assigned, &isMine); err != nil {
		return err
	}
	if assigned && !isMine {
		return ErrNotAssigned
	}

	if phase == PhaseCutting {
		// Cutting: exclusive claim, unchanged
		if b.Status != StatusPending {
			return ErrAlreadyStarted
		}
	} else {
		// Stitching/packing: joinable while pending or in_progress
		if b.Status != StatusPending && b.Status != StatusInProgress {
			return ErrNotStarted
		}
		// Idempotent join: already in? no-op success.
		var joined bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(SELECT 1 FROM phase_logs
			WHERE batch_id=$1 AND phase=$2 AND worker_id=$3 AND completed_at IS NULL)
		`, batchID, phase, workerID).Scan(&joined); err != nil {
			return err
		}
		if joined {
			return tx.Commit(ctx)
		}
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO phase_logs (batch_id, phase, worker_id) VALUES ($1, $2, $3)`,
		batchID, phase, workerID); err != nil {
		return ErrAlreadyStarted // cutting raced, or per-worker index backstop
	}

	if _, err := tx.Exec(ctx,
		`UPDATE batches SET status='in_progress', version=version+1 WHERE id=$1 AND status='pending'`,
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

// SetAssignments replaces one phase's assignees with optional per-head quotas.
// Rules: quotas (if any) must all be present and sum to batch quantity; a target
// can't drop below units already done by that worker; a worker with completed
// units can't be removed. Stitching also operates the awaiting/pending gate.
func (s *Service) SetAssignments(ctx context.Context, batchID uuid.UUID, phase Phase, entries []AssignmentInput, adminID uuid.UUID, ip string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var quantity int
	err = tx.QueryRow(ctx, `SELECT quantity FROM batches WHERE id=$1 FOR UPDATE`, batchID).Scan(&quantity)
	if err == pgx.ErrNoRows {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	attrCol := map[Phase]string{PhaseStitching: "stitched_by", PhasePacking: "packed_by"}[phase]

	// Validate quotas
	withQuota, sum := 0, 0
	for _, e := range entries {
		if e.TargetQty != nil {
			withQuota++
			sum += *e.TargetQty
		}
	}
	if withQuota > 0 && withQuota != len(entries) {
		return fmt.Errorf("%w: give every assignee a quota, or none", ErrInvalidInput)
	}
	if withQuota > 0 && sum != quantity {
		return fmt.Errorf("%w: quotas total %d but batch has %d mats", ErrInvalidInput, sum, quantity)
	}

	// Per-worker done counts guard reductions/removals
	if attrCol != "" {
		rows, err := tx.Query(ctx, `
			SELECT w.id, w.name, COUNT(*) FROM batch_units bu JOIN workers w ON w.id = bu.`+attrCol+`
			WHERE bu.batch_id=$1 GROUP BY w.id, w.name`, batchID)
		if err != nil {
			return err
		}
		done := map[uuid.UUID]struct {
			name string
			n    int
		}{}
		for rows.Next() {
			var id uuid.UUID
			var name string
			var n int
			if err := rows.Scan(&id, &name, &n); err != nil {
				rows.Close()
				return err
			}
			done[id] = struct {
				name string
				n    int
			}{name, n}
		}
		rows.Close()

		kept := map[uuid.UUID]bool{}
		for _, e := range entries {
			kept[e.WorkerID] = true
			if d, ok := done[e.WorkerID]; ok && e.TargetQty != nil && *e.TargetQty < d.n {
				return fmt.Errorf("%w: %s has already done %d — target can't be lower", ErrInvalidInput, d.name, d.n)
			}
		}
		for id, d := range done {
			if !kept[id] {
				return fmt.Errorf("%w: %s has already done %d mats — reduce their target instead of removing them", ErrInvalidInput, d.name, d.n)
			}
		}
	}

	if _, err := tx.Exec(ctx, `DELETE FROM batch_assignments WHERE batch_id=$1 AND phase=$2`, batchID, phase); err != nil {
		return err
	}
	for _, e := range entries {
		if _, err := tx.Exec(ctx, `
			INSERT INTO batch_assignments (batch_id, phase, worker_id, assigned_by, target_qty)
			VALUES ($1,$2,$3,$4,$5) ON CONFLICT (batch_id, phase, worker_id) DO UPDATE SET target_qty = EXCLUDED.target_qty
		`, batchID, phase, e.WorkerID, adminID, e.TargetQty); err != nil {
			return fmt.Errorf("%w: invalid worker for assignment", ErrInvalidInput)
		}
	}

	if phase == PhaseStitching {
		if len(entries) > 0 {
			_, err = tx.Exec(ctx, `UPDATE batches SET status='pending', version=version+1
				WHERE id=$1 AND current_phase='stitching' AND status='awaiting_assignment'`, batchID)
		} else {
			_, err = tx.Exec(ctx, `UPDATE batches SET status='awaiting_assignment', version=version+1
				WHERE id=$1 AND current_phase='stitching' AND status='pending'`, batchID)
		}
		if err != nil {
			return err
		}
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: adminID.String(), ActorRole: "admin",
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		After:  map[string]any{"event": "assignments_set", "phase": phase, "workers": len(entries), "quotas": withQuota > 0},
		IP:     ip,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// MarkStickersPrinted stamps the packing-sticker print time.
func (s *Service) MarkStickersPrinted(ctx context.Context, batchID uuid.UUID) error {
	ct, err := s.pool.Exec(ctx, `UPDATE batches SET stickers_printed_at = NOW() WHERE id = $1`, batchID)
	if err != nil {
		return err
	}
	if ct.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// CompletePhase closes the cutter's open log and advances the batch.
// Cutting ONLY — stitching & packing complete via per-unit scans (ScanUnit).
func (s *Service) CompletePhase(ctx context.Context, batchID, workerID uuid.UUID, station string, quantityCompleted int, notes, ip string) error {
	phase, ok := PhaseForStation[station]
	if !ok {
		return fmt.Errorf("%w: unknown station", ErrInvalidInput)
	}

	// Stitching & packing complete via per-unit scans, never manually.
	if phase == PhaseStitching || phase == PhasePacking {
		return fmt.Errorf("%w: %s completes automatically when all units are scanned", ErrInvalidInput, phase)
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

var ErrUnitNotFound = errors.New("unit not found")

// ScanUnit marks one unit packed (packer's per-unit scan).
// Idempotent on re-scan. Auto-completes the batch on the last unit.
// ScanUnit: stitcher scans a mat they just stitched; packer scans a mat they
// pack. Attribution per worker per unit. Phase auto-advances on last unit,
// closing every joined worker's log with their own scan count.
func (s *Service) ScanUnit(ctx context.Context, unitCode string, workerID uuid.UUID, station, ip string) (*ScanResult, error) {
	phase, ok := PhaseForStation[station]
	if !ok || phase == PhaseCutting {
		return nil, ErrWrongPhase // cutters don't scan units
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		unitID      uuid.UUID
		unitStatus  UnitStatus
		stitchedAt  *time.Time
		batchID     uuid.UUID
		batchCode   string
		batchPhase  Phase
		batchStatus Status
	)
	err = tx.QueryRow(ctx, `
		SELECT bu.id, bu.status, bu.stitched_at, b.id, b.batch_code, b.current_phase, b.status
		FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
		WHERE bu.unit_code = $1 FOR UPDATE OF b
	`, unitCode).Scan(&unitID, &unitStatus, &stitchedAt, &batchID, &batchCode, &batchPhase, &batchStatus)
	if err == pgx.ErrNoRows {
		return nil, ErrUnitNotFound
	}
	if err != nil {
		return nil, err
	}

	res := &ScanResult{UnitCode: unitCode, BatchCode: batchCode, Phase: phase}

	progress := func(doneExpr string) error {
		return tx.QueryRow(ctx, `
			SELECT COUNT(*), COUNT(*) FILTER (WHERE `+doneExpr+`)
			FROM batch_units WHERE batch_id = $1
		`, batchID).Scan(&res.TotalUnits, &res.DoneCount)
	}

	// Idempotent paths
	if phase == PhaseStitching && (stitchedAt != nil || unitStatus == UnitPacked || unitStatus == UnitDispatched) {
		res.AlreadyDone = true
		if err := progress("stitched_at IS NOT NULL"); err != nil {
			return nil, err
		}
		return res, tx.Commit(ctx)
	}
	if phase == PhasePacking && (unitStatus == UnitPacked || unitStatus == UnitDispatched) {
		res.AlreadyDone = true
		if err := progress("status IN ('packed','dispatched')"); err != nil {
			return nil, err
		}
		return res, tx.Commit(ctx)
	}

	// Batch must be at MY phase, in progress
	if batchPhase != phase {
		return nil, ErrWrongPhase
	}
	if batchStatus != StatusInProgress {
		return nil, ErrNotStarted
	}
	// I must have joined (open log of mine)
	var joined bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM phase_logs
		WHERE batch_id=$1 AND phase=$2 AND worker_id=$3 AND completed_at IS NULL)
	`, batchID, phase, workerID).Scan(&joined); err != nil {
		return nil, err
	}
	// Quota gate: if my assignment carries a target, I can't exceed it.
	{
		attrCol := "stitched_by"
		if phase == PhasePacking {
			attrCol = "packed_by"
		}
		var target *int
		var mine int
		err := tx.QueryRow(ctx, `
			SELECT (SELECT target_qty FROM batch_assignments WHERE batch_id=$1 AND phase=$2 AND worker_id=$3),
			       (SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND `+attrCol+`=$3)
		`, batchID, phase, workerID).Scan(&target, &mine)
		if err != nil {
			return nil, err
		}
		if target != nil && mine >= *target {
			return nil, fmt.Errorf("%w (%d/%d)", ErrQuotaReached, mine, *target)
		}
	}
	if !joined {
		return nil, ErrNotStarted
	}

	// Apply the scan
	if phase == PhaseStitching {
		if _, err := tx.Exec(ctx,
			`UPDATE batch_units SET stitched_by=$1, stitched_at=NOW() WHERE id=$2`,
			workerID, unitID); err != nil {
			return nil, err
		}
		if err := progress("stitched_at IS NOT NULL"); err != nil {
			return nil, err
		}
	} else {
		if _, err := tx.Exec(ctx,
			`UPDATE batch_units SET status='packed', packed_by=$1, packed_at=NOW() WHERE id=$2`,
			workerID, unitID); err != nil {
			return nil, err
		}
		if err := progress("status IN ('packed','dispatched')"); err != nil {
			return nil, err
		}
	}

	// Last unit → close ALL open logs with per-worker counts, advance batch
	if res.DoneCount >= res.TotalUnits {
		attrCol := "stitched_by"
		if phase == PhasePacking {
			attrCol = "packed_by"
		}
		if _, err := tx.Exec(ctx, `
			UPDATE phase_logs pl
			SET completed_at = NOW(),
			    quantity_completed = (SELECT COUNT(*) FROM batch_units bu
			                          WHERE bu.batch_id=$1 AND bu.`+attrCol+`=pl.worker_id)
			WHERE pl.batch_id=$1 AND pl.phase=$2 AND pl.completed_at IS NULL
		`, batchID, phase); err != nil {
			return nil, err
		}
		next, newStatus := nextPhase(phase)
		if _, err := tx.Exec(ctx,
			`UPDATE batches SET current_phase=$1, status=$2, version=version+1 WHERE id=$3`,
			next, newStatus, batchID); err != nil {
			return nil, err
		}
		if phase == PhaseStitching {
			res.PhaseCompleted = true
		} else {
			res.BatchCompleted = true
		}
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: workerID.String(), ActorRole: station,
		EntityType: "batch_unit", EntityID: unitID.String(),
		Action: audit.ActionTransition,
		After: map[string]any{"unit_code": unitCode, "event": string(phase) + "_scan",
			"progress": fmt.Sprintf("%d/%d", res.DoneCount, res.TotalUnits)},
		IP: ip,
	}); err != nil {
		return nil, err
	}
	return res, tx.Commit(ctx)
}
