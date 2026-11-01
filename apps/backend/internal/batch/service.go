package batch

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/audit"
	"github.com/pc1605/rps/apps/backend/internal/factorytime"
)

var (
	ErrInvalidInput          = errors.New("invalid input")
	ErrNotFound              = errors.New("batch not found")
	ErrInRework              = errors.New("this mat is waiting for rework")
	ErrUnitWrittenOff        = errors.New("this mat was written off — keep it aside")
	ErrAlreadyInRework       = errors.New("this mat is already in rework")
	ErrReworkPendingDecision = errors.New("rework is awaiting admin decision")
	ErrNotYourRework         = errors.New("this rework is assigned to another stitcher")
	ErrReworkNotOpen         = errors.New("rework round is not open")
)

type Service struct {
	pool      *pgxpool.Pool
	uploadDir string
}

type Stats struct {
	InCutting           int `json:"in_cutting"`
	InStitching         int `json:"in_stitching"`
	InPacking           int `json:"in_packing"`
	AwaitingAssignment  int `json:"awaiting_assignment"`
	CompletedToday      int `json:"completed_today"`
	TotalActive         int `json:"total_active"`
	ReworkOpen          int `json:"rework_open"`
	ReworkNeedsDecision int `json:"rework_needs_decision"`
	// Materials (C1b): shortfall movements in the last 30 days; active types below min_level.
	MaterialShortfallsOpen int `json:"material_shortfalls_open"`
	LowStockTypes          int `json:"low_stock_types"`
	// U2: who's working now per phase (open logs at the batch's current phase) — feeds the pipeline
	// without loading every batch.
	Working map[string][]string `json:"working"`
}

func NewService(pool *pgxpool.Pool, uploadDir string) *Service {
	if uploadDir == "" {
		uploadDir = "./uploads"
	}
	return &Service{pool: pool, uploadDir: uploadDir}
}

func (s *Service) UploadDir() string {
	return s.uploadDir
}

// Create makes a batch + all its unit rows + an audit entry, atomically.
func (s *Service) Create(ctx context.Context, in CreateInput, actorID uuid.UUID, actorRole, ip string) (*Batch, error) {
	if in.CarModelID <= 0 || in.Quantity <= 0 {
		return nil, ErrInvalidInput
	}
	if in.SparesStitched < 0 || in.SparesUnstitched < 0 {
		return nil, fmt.Errorf("%w: spare counts can't be negative", ErrInvalidInput)
	}
	spares := in.SparesStitched + in.SparesUnstitched
	if spares > in.Quantity {
		return nil, fmt.Errorf("%w: %d spare mats is more than the batch quantity (%d)", ErrInvalidInput, spares, in.Quantity)
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
	var rollCode string
	if in.RollID != nil && *in.RollID != "" {
		parsed, err := uuid.Parse(*in.RollID)
		if err != nil {
			return nil, fmt.Errorf("%w: bad roll_id", ErrInvalidInput)
		}
		err = tx.QueryRow(ctx, `SELECT lot_code FROM material_lots WHERE id = $1 AND is_active`, parsed).Scan(&rollCode)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: roll not found or inactive", ErrInvalidInput)
		}
		if err != nil {
			return nil, err
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
	if rollID != nil {
		b.RollCode = &rollCode
	}

	// 5. Reused spares (U3, D36) move in first as units 1..k — already cut, so the cutter cuts the rest
	// (cut units are the lowest numbers). Unstitched ones get this batch's code; stitched ones keep
	// theirs (the label is on the mat) and count as stitched, credit staying with their stitcher.
	evData := map[string]any{"quantity": in.Quantity}
	if spares > 0 {
		ids, oldCodes, err := pickSpares(ctx, tx, in.CarModelID, in.SparesStitched, in.SparesUnstitched)
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE batch_units bu SET reused_from = bu.batch_id, batch_id = $1, unit_number = o.n, status = 'pending',
			  prestitched = bu.stitched_at IS NOT NULL,
			  unit_code = CASE WHEN bu.stitched_at IS NULL THEN $2 || '-' || LPAD(o.n::TEXT, 3, '0') ELSE bu.unit_code END
			FROM unnest($3::uuid[]) WITH ORDINALITY AS o(id, n)
			WHERE bu.id = o.id`, b.ID, b.BatchCode, ids); err != nil {
			return nil, fmt.Errorf("reuse spares: %w", err)
		}
		evData["spares_stitched"] = in.SparesStitched
		evData["spares_unstitched"] = in.SparesUnstitched
		evData["spare_codes"] = oldCodes
	}

	// 6. Insert the remaining units in one statement (Hard Rule #18)
	_, err = tx.Exec(ctx, `
		INSERT INTO batch_units (batch_id, unit_code, unit_number)
		SELECT $1, $2 || '-' || LPAD(gs.n::TEXT, 3, '0'), gs.n
		FROM generate_series($4::int + 1, $3::int) AS gs(n)
	`, b.ID, b.BatchCode, in.Quantity, spares)
	if err != nil {
		return nil, fmt.Errorf("insert units: %w", err)
	}

	// Spares covering the whole batch skip cutting; all of them stitched → straight to packing.
	if spares > 0 {
		b.CutQty = spares
		if spares == in.Quantity {
			b.CurrentPhase, b.Status = PhaseStitching, StatusAwaitingAssignment
			if in.SparesStitched == in.Quantity {
				b.CurrentPhase, b.Status = PhasePacking, StatusPending
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE batches SET cut_qty = $2, current_phase = $3, status = $4 WHERE id = $1`,
			b.ID, b.CutQty, b.CurrentPhase, b.Status); err != nil {
			return nil, err
		}
	}

	if err := writeEvent(ctx, tx, Event{BatchID: b.ID, Kind: EvCreated, ToPhase: b.CurrentPhase, ToStatus: b.Status,
		UserID: uid(actorID), Data: evData}); err != nil {
		return nil, err
	}

	// 7. Audit (same tx — Hard Rule #16)
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
	b.UnitsStitched = in.SparesStitched
	b.UnitsPrestitched = in.SparesStitched
	return &b, nil
}

// List returns every batch, newest first (no paging — tests and internal use; the API uses ListPage).
func (s *Service) List(ctx context.Context) ([]Batch, error) {
	p, err := s.ListPage(ctx, ListFilter{Desc: true})
	if err != nil {
		return nil, err
	}
	return p.Items, nil
}

// Get returns one batch with its units.
func (s *Service) Get(ctx context.Context, id uuid.UUID) (*BatchDetail, error) {
	var b Batch
	err := s.pool.QueryRow(ctx, `
		SELECT b.id, b.batch_code, b.car_model_id,
		       cb.name, cm.name,cm.size_class::text, pl.code, pl.name, cm.barcode,
		       b.roll_id, rm.lot_code,
		       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
		       b.rework_count, b.created_by, u.name,
		       b.version, b.created_at, b.updated_at,
		       b.cut_qty, b.parent_batch_id, pb.batch_code, b.short_reason, b.stickers_printed_at,
		       (SELECT COUNT(*) FROM rework_logs rl WHERE rl.batch_id = b.id AND rl.fixed_at IS NULL AND (rl.decision IS NULL OR rl.decision = 'to_stitcher'))
		FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		LEFT JOIN batches pb ON pb.id = b.parent_batch_id
		JOIN users u       ON u.id = b.created_by
		LEFT JOIN material_lots rm ON rm.id = b.roll_id
		WHERE b.id = $1
	`, id).Scan(
		&b.ID, &b.BatchCode, &b.CarModelID,
		&b.BrandName, &b.ModelName, &b.SizeClass, &b.LineCode, &b.LineName, &b.Barcode,
		&b.RollID, &b.RollCode,
		&b.Quantity, &b.CurrentPhase, &b.Status, &b.Notes,
		&b.ReworkCount, &b.CreatedBy, &b.CreatedByName,
		&b.Version, &b.CreatedAt, &b.UpdatedAt,
		&b.CutQty, &b.ParentBatchID, &b.ParentBatchCode, &b.ShortReason, &b.StickersPrintedAt,
		&b.ReworkOpen,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT bu.id, bu.batch_id, bu.unit_code, bu.unit_number, bu.status,
		       bu.stitched_at, bu.stitched_by, ws.name, bu.packed_at, bu.packed_by, wp.name, bu.created_at,
		       bu.reused_from, rb.batch_code, bu.prestitched
		FROM batch_units bu
		LEFT JOIN workers ws ON ws.id = bu.stitched_by
		LEFT JOIN workers wp ON wp.id = bu.packed_by
		LEFT JOIN batches rb ON rb.id = bu.reused_from
		WHERE bu.batch_id = $1 ORDER BY bu.unit_number
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	detail := &BatchDetail{Batch: b, Units: []Unit{}}
	for rows.Next() {
		var u Unit
		if err := rows.Scan(&u.ID, &u.BatchID, &u.UnitCode, &u.UnitNumber, &u.Status, &u.StitchedAt, &u.StitchedBy, &u.StitchedByName, &u.PackedAt, &u.PackedBy, &u.PackedByName, &u.CreatedAt,
			&u.ReusedFrom, &u.ReusedFromCode, &u.Prestitched); err != nil {
			return nil, err
		}
		u.Rework = []ReworkEntry{}
		if u.Prestitched {
			detail.UnitsPrestitched++
		}
		detail.Units = append(detail.Units, u)
		detail.UnitsTotal++
		switch u.Status {
		case UnitPacked:
			detail.UnitsPacked++
		case UnitDefective:
			detail.UnitsWrittenOff++
		}
		if u.StitchedAt != nil {
			detail.UnitsStitched++
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Load rework entries for all units in this batch
	reworkRows, err := s.pool.Query(ctx, `
		SELECT rl.id, rl.unit_id, bu.unit_code, rl.batch_id, rl.round, rl.reasons, rl.note, rl.route,
		       w.name, rl.flagged_by, rl.flagged_at, rl.decision, rl.decided_at, wf.name, rl.fixed_by, rl.fixed_at, ws.name, bu.stitched_by
		FROM rework_logs rl
		JOIN batch_units bu ON bu.id = rl.unit_id
		JOIN workers w ON w.id = rl.flagged_by
		LEFT JOIN workers wf ON wf.id = rl.fixed_by
		LEFT JOIN workers ws ON ws.id = bu.stitched_by
		WHERE rl.batch_id = $1
		ORDER BY rl.round ASC, rl.flagged_at ASC
	`, id)
	if err != nil {
		return nil, err
	}
	defer reworkRows.Close()

	var allRework []*ReworkEntry
	reworkByUnit := make(map[uuid.UUID][]ReworkEntry)
	for reworkRows.Next() {
		var e ReworkEntry
		var fixedByName *string
		if err := reworkRows.Scan(
			&e.ID, &e.UnitID, &e.UnitCode, &e.BatchID, &e.Round, &e.Reasons, &e.Note, &e.Route,
			&e.FlaggedByName, &e.FlaggedBy, &e.FlaggedAt, &e.Decision, &e.DecidedAt, &fixedByName, &e.FixedBy, &e.FixedAt,
			&e.StitcherName, &e.StitcherID,
		); err != nil {
			return nil, err
		}
		e.FixedByName = fixedByName
		allRework = append(allRework, &e)
	}
	if err := reworkRows.Err(); err != nil {
		return nil, err
	}
	if err := s.attachPhotos(ctx, allRework); err != nil {
		return nil, err
	}
	for _, e := range allRework {
		reworkByUnit[e.UnitID] = append(reworkByUnit[e.UnitID], *e)
	}
	for i := range detail.Units {
		if rw, ok := reworkByUnit[detail.Units[i].ID]; ok {
			detail.Units[i].Rework = rw
		}
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
		          AND ((ba.phase = 'stitching' AND bu.stitched_by = ba.worker_id AND NOT bu.prestitched)
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
		  -- D5: the completion event's time, not updated_at (a later reprint/note doesn't move it to "today")
		  (SELECT COUNT(DISTINCT e.batch_id) FROM batch_events e JOIN batches cb ON cb.id = e.batch_id
		    WHERE e.kind = 'completed' AND cb.status = 'completed'
		      AND (e.at AT TIME ZONE $1)::date = (NOW() AT TIME ZONE $1)::date),
		  COUNT(*) FILTER (WHERE status NOT IN ('completed','cancelled')),
		  (SELECT COUNT(*) FROM rework_logs WHERE fixed_at IS NULL AND (decision IS NULL OR decision = 'to_stitcher')),
		  (SELECT COUNT(*) FROM rework_logs WHERE route = 'admin' AND decision IS NULL),
		  (SELECT COUNT(*) FROM material_movements
		    WHERE lot_id IS NULL AND created_at > NOW() - INTERVAL '30 days'),
		  (SELECT COUNT(*) FROM material_types t
		    WHERE t.is_active AND t.min_level IS NOT NULL
		      AND COALESCE((SELECT SUM(l.qty_remaining) FROM material_lots l
		                    WHERE l.material_type_id = t.id AND l.is_active), 0) < t.min_level)
		FROM batches
	`, factorytime.Name()).Scan(
		&st.InCutting,
		&st.AwaitingAssignment,
		&st.InStitching,
		&st.InPacking,
		&st.CompletedToday,
		&st.TotalActive,
		&st.ReworkOpen,
		&st.ReworkNeedsDecision,
		&st.MaterialShortfallsOpen,
		&st.LowStockTypes,
	)
	if err != nil {
		return nil, err
	}
	st.Working = map[string][]string{}
	rows, err := s.pool.Query(ctx, `
		SELECT b.current_phase::text, array_agg(DISTINCT w.name ORDER BY w.name)
		FROM phase_logs pl
		JOIN batches b ON b.id = pl.batch_id AND pl.phase = b.current_phase
		JOIN workers w ON w.id = pl.worker_id
		WHERE pl.completed_at IS NULL
		GROUP BY 1`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var phase string
		var names []string
		if err := rows.Scan(&phase, &names); err != nil {
			return nil, err
		}
		st.Working[phase] = names
	}
	if err := rows.Err(); err != nil {
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
		       cb.name, cm.name, cm.size_class::text, pl.code, pl.name, cm.barcode,
		       b.roll_id, rm.lot_code,
		       b.quantity, b.current_phase, b.status, COALESCE(b.notes,''),
		       b.rework_count, b.created_by, u.name,
		       b.version, b.created_at, b.updated_at,
		       b.cut_qty, b.parent_batch_id, pb.batch_code, b.short_reason,
		       -- unit roll-ups
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'packed'),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.stitched_at IS NOT NULL),
		       (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = b.id AND bu.status = 'defective'),
		       (SELECT COUNT(*) FROM rework_logs rl WHERE rl.batch_id = b.id AND rl.fixed_at IS NULL AND (rl.decision IS NULL OR rl.decision = 'to_stitcher')),
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
		          AND ((b.current_phase = 'stitching' AND bu.stitched_by = $2 AND NOT bu.prestitched)
		            OR (b.current_phase = 'packing'   AND bu.packed_by   = $2)))
		FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pl ON pl.id = cm.product_line_id
		LEFT JOIN batches pb ON pb.id = b.parent_batch_id
		JOIN users u       ON u.id = b.created_by
		LEFT JOIN material_lots rm ON rm.id = b.roll_id
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
			&b.BrandName, &b.ModelName, &b.SizeClass, &b.LineCode, &b.LineName, &b.Barcode,
			&b.RollID, &b.RollCode,
			&b.Quantity, &b.CurrentPhase, &b.Status, &b.Notes,
			&b.ReworkCount, &b.CreatedBy, &b.CreatedByName,
			&b.Version, &b.CreatedAt, &b.UpdatedAt,
			&b.CutQty, &b.ParentBatchID, &b.ParentBatchCode, &b.ShortReason,
			&b.UnitsTotal, &b.UnitsPacked, &b.UnitsStitched, &b.UnitsWrittenOff, &b.ReworkOpen,
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
	if errors.Is(err, pgx.ErrNoRows) {
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

	tag, err := tx.Exec(ctx,
		`UPDATE batches SET status='in_progress', version=version+1 WHERE id=$1 AND status='pending'`,
		batchID)
	if err != nil {
		return err
	}
	// Cutting: every claim is a start. Stitching/packing: the first join starts the phase.
	startKind := map[Phase]EventKind{PhaseCutting: EvCutStarted, PhaseStitching: EvStitchingStarted, PhasePacking: EvPackingStarted}[phase]
	if phase == PhaseCutting || tag.RowsAffected() == 1 {
		if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: startKind, FromPhase: phase, ToPhase: phase,
			FromStatus: b.Status, ToStatus: StatusInProgress, WorkerID: uid(workerID)}); err != nil {
			return err
		}
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

	var quantity, cutQty int
	err = tx.QueryRow(ctx, `SELECT quantity, cut_qty FROM batches WHERE id=$1 FOR UPDATE`, batchID).Scan(&quantity, &cutQty)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if phase == PhaseStitching && cutQty < quantity && len(entries) > 0 {
		return fmt.Errorf("%w: only %d of %d mats are cut — resolve the short cut before assigning", ErrInvalidInput, cutQty, quantity)
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
	// Stitching quotas cover the mats still to stitch: reused spares that came in stitched are left out (D36).
	toDo := quantity
	if phase == PhaseStitching {
		var pre int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND prestitched`, batchID).Scan(&pre); err != nil {
			return err
		}
		toDo -= pre
	}
	if withQuota > 0 && sum != toDo {
		if toDo != quantity {
			return fmt.Errorf("%w: quotas total %d but %d mats are left to stitch (%d came in stitched)", ErrInvalidInput, sum, toDo, quantity-toDo)
		}
		return fmt.Errorf("%w: quotas total %d but batch has %d mats", ErrInvalidInput, sum, quantity)
	}

	// Per-worker done counts guard reductions/removals
	if attrCol != "" {
		rows, err := tx.Query(ctx, `
			SELECT w.id, w.name, COUNT(*) FROM batch_units bu JOIN workers w ON w.id = bu.`+attrCol+`
			WHERE bu.batch_id=$1 AND NOT (bu.prestitched AND $2 = 'stitching') GROUP BY w.id, w.name`, batchID, phase)
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

	before, err := assignmentTargets(ctx, tx, batchID, phase)
	if err != nil {
		return err
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

	ev := Event{BatchID: batchID, Kind: EvAssigned, UserID: uid(adminID)}
	if phase == PhaseStitching {
		var tag pgconn.CommandTag
		if len(entries) > 0 {
			tag, err = tx.Exec(ctx, `UPDATE batches SET status='pending', version=version+1
				WHERE id=$1 AND current_phase='stitching' AND status='awaiting_assignment'`, batchID)
			ev.FromStatus, ev.ToStatus = StatusAwaitingAssignment, StatusPending
		} else {
			tag, err = tx.Exec(ctx, `UPDATE batches SET status='awaiting_assignment', version=version+1
				WHERE id=$1 AND current_phase='stitching' AND status='pending'`, batchID)
			ev.FromStatus, ev.ToStatus = StatusPending, StatusAwaitingAssignment
		}
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			ev.FromStatus, ev.ToStatus = "", ""
		} else {
			ev.FromPhase, ev.ToPhase = PhaseStitching, PhaseStitching
		}
	}
	after, err := assignmentTargets(ctx, tx, batchID, phase)
	if err != nil {
		return err
	}
	ev.Data = map[string]any{"phase": phase, "before": before, "after": after}
	if err := writeEvent(ctx, tx, ev); err != nil {
		return err
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

type ShortAction string

const (
	ShortSplit  ShortAction = "split"
	ShortReduce ShortAction = "reduce"
	ShortRecut  ShortAction = "recut"
)

// ShortReasonLabel: the reasons a short cut can be resolved with (W5). Mirrors SHORT_REASON_LABEL in @rps/shared.
var ShortReasonLabel = map[string]string{
	"roll_ran_out":    "Roll ran out",
	"material_defect": "Material defect",
	"machine_issue":   "Machine issue",
	"cutter_error":    "Cutter error",
	"order_changed":   "Order changed",
	"other":           "Other",
}

// ResolveShort is the admin's decision on a batch that came out of cutting short.
// Allowed only while parked (awaiting_assignment) with cut_qty < quantity.
// reason is a ShortReasonLabel code (required for every action); note is required for "other".
func (s *Service) ResolveShort(ctx context.Context, batchID uuid.UUID, action ShortAction, reason, note string, adminID uuid.UUID, ip string) (string, error) {
	label, ok := ShortReasonLabel[reason]
	if !ok {
		return "", fmt.Errorf("%w: pick a reason for the short cut", ErrInvalidInput)
	}
	if reason == "other" && note == "" {
		return "", fmt.Errorf("%w: describe the reason when it is Other", ErrInvalidInput)
	}
	if note != "" {
		label += ": " + note
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)

	var b struct {
		Code      string
		Phase     Phase
		Status    Status
		Quantity  int
		CutQty    int
		CarModel  int
		RollID    *uuid.UUID
		CreatedBy uuid.UUID
	}
	err = tx.QueryRow(ctx, `
		SELECT batch_code, current_phase, status, quantity, cut_qty, car_model_id, roll_id, created_by
		FROM batches WHERE id = $1 FOR UPDATE`, batchID).
		Scan(&b.Code, &b.Phase, &b.Status, &b.Quantity, &b.CutQty, &b.CarModel, &b.RollID, &b.CreatedBy)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrNotFound
	}
	if err != nil {
		return "", err
	}
	if b.Phase != PhaseStitching || b.Status != StatusAwaitingAssignment {
		return "", fmt.Errorf("%w: batch is not waiting for a short-cut decision", ErrInvalidInput)
	}
	if b.CutQty >= b.Quantity {
		return "", fmt.Errorf("%w: batch is fully cut", ErrInvalidInput)
	}
	short := b.Quantity - b.CutQty
	remainderCode := ""

	switch action {
	case ShortSplit, ShortReduce:
		if _, err := tx.Exec(ctx, `DELETE FROM batch_units WHERE batch_id = $1 AND unit_number > $2`, batchID, b.CutQty); err != nil {
			return "", err
		}
		msg := fmt.Sprintf("Reduced from %d to %d (%s)", b.Quantity, b.CutQty, label)
		if action == ShortSplit {
			if err := tx.QueryRow(ctx, `SELECT next_batch_code()`).Scan(&remainderCode); err != nil {
				return "", err
			}
			var remID uuid.UUID
			if err := tx.QueryRow(ctx, `
				INSERT INTO batches (batch_code, car_model_id, roll_id, quantity, notes, created_by, parent_batch_id)
				VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
				remainderCode, b.CarModel, b.RollID, short,
				fmt.Sprintf("Remainder of %s (%d of %d were cut)", b.Code, b.CutQty, b.Quantity),
				b.CreatedBy, batchID).Scan(&remID); err != nil {
				return "", fmt.Errorf("remainder batch: %w", err)
			}
			if err := writeEvent(ctx, tx, Event{BatchID: remID, Kind: EvCreated, ToPhase: PhaseCutting, ToStatus: StatusPending,
				UserID: uid(adminID), Data: map[string]any{"quantity": short, "parent": batchID, "via": "split"}}); err != nil {
				return "", err
			}
			if _, err := tx.Exec(ctx, `
				INSERT INTO batch_units (batch_id, unit_code, unit_number)
				SELECT $1, $2 || '-' || LPAD(gs.n::TEXT, 3, '0'), gs.n FROM generate_series(1, $3::int) AS gs(n)`,
				remID, remainderCode, short); err != nil {
				return "", fmt.Errorf("remainder units: %w", err)
			}
			msg = fmt.Sprintf("Short cut %d of %d — remainder → %s (%s)", b.CutQty, b.Quantity, remainderCode, label)
		}
		if _, err := tx.Exec(ctx, `
			UPDATE batches SET quantity = $1, short_reason = NULLIF($2,''),
			  notes = CONCAT_WS(E'\n', NULLIF(notes,''), $3::text), version = version + 1
			WHERE id = $4`, b.CutQty, label, msg, batchID); err != nil {
			return "", err
		}

	case ShortRecut:
		// back to the open cutting queue; units untouched; cut_qty keeps accumulating
		if _, err := tx.Exec(ctx, `
			UPDATE batches SET current_phase = 'cutting', status = 'pending',
			  notes = CONCAT_WS(E'\n', NULLIF(notes,''), $1::text), version = version + 1
			WHERE id = $2`, fmt.Sprintf("Sent back to cut remaining %d (%s)", short, label), batchID); err != nil {
			return "", err
		}
	default:
		return "", fmt.Errorf("%w: action must be split, reduce or recut", ErrInvalidInput)
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: adminID.String(), ActorRole: "admin",
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		After:  map[string]any{"event": "short_cut_" + string(action), "cut": b.CutQty, "quantity": b.Quantity, "remainder": remainderCode, "reason": reason, "note": note},
		IP:     ip,
	}); err != nil {
		return "", err
	}
	ev := Event{BatchID: batchID, Kind: EvShortResolved, FromPhase: b.Phase, ToPhase: b.Phase,
		FromStatus: b.Status, ToStatus: b.Status, UserID: uid(adminID),
		Data: map[string]any{"action": action, "reason": reason, "cut": b.CutQty, "quantity": b.Quantity}}
	if note != "" {
		ev.Data["note"] = note
	}
	if action == ShortRecut {
		ev.ToPhase, ev.ToStatus = PhaseCutting, StatusPending
	}
	if remainderCode != "" {
		ev.Data["remainder"] = remainderCode
	}
	if err := writeEvent(ctx, tx, ev); err != nil {
		return "", err
	}
	return remainderCode, tx.Commit(ctx)
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

	if quantityCompleted < 1 {
		return fmt.Errorf("%w: report at least 1 piece — or leave the batch open", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var cur struct {
		Phase    Phase
		Status   Status
		Quantity int
		CutQty   int
	}
	err = tx.QueryRow(ctx,
		`SELECT current_phase, status, quantity, cut_qty FROM batches WHERE id = $1 FOR UPDATE`,
		batchID).Scan(&cur.Phase, &cur.Status, &cur.Quantity, &cur.CutQty)
	if errors.Is(err, pgx.ErrNoRows) {
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
	remaining := cur.Quantity - cur.CutQty
	if quantityCompleted > remaining {
		return fmt.Errorf("%w: only %d pieces remain to cut in this batch", ErrInvalidInput, remaining)
	}

	// Close MY open log — worker_id in the WHERE enforces the exclusive claim.
	var logID uuid.UUID
	err = tx.QueryRow(ctx, `
		UPDATE phase_logs
		SET completed_at = NOW(), quantity_completed = $1, notes = NULLIF($2,'')
		WHERE batch_id = $3 AND phase = $4 AND completed_at IS NULL AND worker_id = $5
		RETURNING id
	`, quantityCompleted, notes, batchID, phase, workerID).Scan(&logID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotYours // an open log exists (status=in_progress) but isn't this worker's
	}
	if err != nil {
		return err
	}

	next, newStatus := nextPhase(phase)
	if _, err := tx.Exec(ctx,
		`UPDATE batches SET current_phase = $1, status = $2, cut_qty = cut_qty + $3, version = version + 1 WHERE id = $4`,
		next, newStatus, quantityCompleted, batchID); err != nil {
		return err
	}

	if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: EvCutCompleted, FromPhase: phase, ToPhase: next,
		FromStatus: cur.Status, ToStatus: newStatus, WorkerID: uid(workerID),
		Data: map[string]any{"cut": quantityCompleted, "cut_total": cur.CutQty + quantityCompleted, "quantity": cur.Quantity,
			"short": cur.CutQty+quantityCompleted < cur.Quantity}}); err != nil {
		return err
	}

	// Materials for exactly these pieces (materials.md). Same tx; never fails for stock problems.
	if err := consumeForCutting(ctx, tx, batchID, logID, quantityCompleted, workerID); err != nil {
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

// PeekUnit is a read-only check for packers before showing the inspect sheet.
func (s *Service) PeekUnit(ctx context.Context, unitCode string, workerID uuid.UUID) (*UnitPeek, error) {
	var (
		unitID      uuid.UUID
		unitStatus  UnitStatus
		batchID     uuid.UUID
		batchCode   string
		batchPhase  Phase
		batchStatus Status
	)
	err := s.pool.QueryRow(ctx, `
		SELECT bu.id, bu.status, b.id, b.batch_code, b.current_phase, b.status
		FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
		WHERE bu.unit_code = $1
	`, unitCode).Scan(&unitID, &unitStatus, &batchID, &batchCode, &batchPhase, &batchStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUnitNotFound
	}
	if err != nil {
		return nil, err
	}

	var joined bool
	err = s.pool.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM phase_logs
			WHERE batch_id = $1 AND phase = 'packing' AND worker_id = $2 AND completed_at IS NULL
		)
	`, batchID, workerID).Scan(&joined)
	if err != nil {
		return nil, err
	}

	canPack := unitStatus == UnitPending && batchPhase == PhasePacking && batchStatus == StatusInProgress && joined
	canRework := canPack

	var reason *string
	if !canPack {
		var r string
		if unitStatus == UnitPacked || unitStatus == UnitDispatched {
			r = "already_packed"
		} else if unitStatus == UnitRework {
			r = "in_rework"
		} else if unitStatus == UnitDefective {
			r = "written_off"
		} else if unitStatus == UnitSpare {
			r = "spare"
		} else if batchPhase != PhasePacking {
			r = "wrong_phase"
		} else if !joined || batchStatus != StatusInProgress {
			r = "not_started"
		}
		if r != "" {
			reason = &r
		}
	}

	return &UnitPeek{
		UnitCode:    unitCode,
		BatchID:     batchID,
		BatchCode:   batchCode,
		Status:      unitStatus,
		BatchPhase:  batchPhase,
		BatchStatus: batchStatus,
		Joined:      joined,
		CanPack:     canPack,
		CanRework:   canRework,
		Reason:      reason,
	}, nil
}

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
		stitchedBy  *uuid.UUID
		batchID     uuid.UUID
		batchCode   string
		batchPhase  Phase
		batchStatus Status
	)
	err = tx.QueryRow(ctx, `
		SELECT bu.id, bu.status, bu.stitched_at, bu.stitched_by, b.id, b.batch_code, b.current_phase, b.status
		FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
		WHERE bu.unit_code = $1 FOR UPDATE OF b
	`, unitCode).Scan(&unitID, &unitStatus, &stitchedAt, &stitchedBy, &batchID, &batchCode, &batchPhase, &batchStatus)
	if errors.Is(err, pgx.ErrNoRows) {
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

	// Top branch: unit is in rework
	if unitStatus == UnitRework {
		if phase == PhasePacking {
			return nil, ErrInRework
		}
		if phase != PhaseStitching {
			return nil, ErrWrongPhase
		}

		var (
			reworkLogID    uuid.UUID
			reworkRound    int
			reworkRoute    string
			reworkDecision *string
		)
		err := tx.QueryRow(ctx, `
			SELECT id, round, route, decision
			FROM rework_logs
			WHERE unit_id = $1 AND fixed_at IS NULL AND (decision IS NULL OR decision = 'to_stitcher')
			FOR UPDATE
		`, unitID).Scan(&reworkLogID, &reworkRound, &reworkRoute, &reworkDecision)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrReworkNotOpen
		}
		if err != nil {
			return nil, err
		}

		if reworkRoute == "admin" && reworkDecision == nil {
			return nil, ErrReworkPendingDecision
		}
		if stitchedBy == nil || *stitchedBy != workerID {
			return nil, ErrNotYourRework
		}

		// Unit back to pending, close round
		if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'pending' WHERE id = $1`, unitID); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE rework_logs SET fixed_by = $1, fixed_at = NOW() WHERE id = $2`, workerID, reworkLogID); err != nil {
			return nil, err
		}

		if batchPhase == PhasePacking {
			if err := progress("status IN ('packed','dispatched','defective')"); err != nil {
				return nil, err
			}
		} else {
			if err := progress("stitched_at IS NOT NULL"); err != nil {
				return nil, err
			}
		}

		res.ReworkFixed = true

		if err := audit.Write(ctx, tx, audit.Entry{
			ActorID:    workerID.String(),
			ActorRole:  station,
			EntityType: "batch_unit",
			EntityID:   unitID.String(),
			Action:     audit.ActionTransition,
			After: map[string]any{
				"unit_code": unitCode,
				"event":     "rework_fixed",
				"round":     reworkRound,
			},
			IP: ip,
		}); err != nil {
			return nil, err
		}

		return res, tx.Commit(ctx)
	}

	if unitStatus == UnitDefective {
		return nil, ErrUnitWrittenOff
	}
	if unitStatus == UnitSpare {
		return nil, ErrUnitSpare
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
		if err := progress("status IN ('packed','dispatched','defective')"); err != nil {
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
			       (SELECT COUNT(*) FROM batch_units WHERE batch_id=$1 AND `+attrCol+`=$3 AND NOT (prestitched AND $2 = 'stitching'))
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
		if err := progress("status IN ('packed','dispatched','defective')"); err != nil {
			return nil, err
		}
	}

	// Last unit → close ALL open logs with per-worker counts, advance batch
	if phase == PhasePacking {
		completed, err := completePackingIfDone(ctx, tx, batchID)
		if err != nil {
			return nil, err
		}
		if completed {
			res.BatchCompleted = true
		}
	} else {
		if res.DoneCount >= res.TotalUnits {
			if _, err := tx.Exec(ctx, `
				UPDATE phase_logs pl
				SET completed_at = NOW(),
				    quantity_completed = (SELECT COUNT(*) FROM batch_units bu
				                          WHERE bu.batch_id=$1 AND bu.stitched_by=pl.worker_id AND NOT bu.prestitched)
				WHERE pl.batch_id=$1 AND pl.phase='stitching' AND pl.completed_at IS NULL
			`, batchID); err != nil {
				return nil, err
			}
			next, newStatus := nextPhase(PhaseStitching)
			if _, err := tx.Exec(ctx,
				`UPDATE batches SET current_phase=$1, status=$2, version=version+1 WHERE id=$3`,
				next, newStatus, batchID); err != nil {
				return nil, err
			}
			if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: EvStitchingCompleted, FromPhase: PhaseStitching,
				ToPhase: next, FromStatus: batchStatus, ToStatus: newStatus, WorkerID: uid(workerID)}); err != nil {
				return nil, err
			}
			res.PhaseCompleted = true
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
