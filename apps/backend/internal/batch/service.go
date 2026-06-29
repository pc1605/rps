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