package stock

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

var (
	ErrInvalidInput  = errors.New("invalid input")
	ErrNotFound      = errors.New("roll not found")
	ErrDuplicateCode = errors.New("roll code already exists")
)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// List returns ALL rolls (active + finished), newest first, with low-stock flag.
func (s *Service) List(ctx context.Context) ([]Roll, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT r.id, r.roll_code, r.color, r.total_meters, r.remaining_meters,
		       r.is_active, r.received_at, r.created_at,
		       (SELECT COUNT(*) FROM batches b WHERE b.roll_id = r.id)
		FROM raw_materials r
		ORDER BY r.is_active DESC, r.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Roll{}
	for rows.Next() {
		var r Roll
		if err := rows.Scan(&r.ID, &r.RollCode, &r.Color, &r.TotalMeters, &r.RemainingMeters,
			&r.IsActive, &r.ReceivedAt, &r.CreatedAt, &r.BatchCount); err != nil {
			return nil, err
		}
		r.IsLow = r.IsActive && r.RemainingMeters < LowStockMeters
		out = append(out, r)
	}
	return out, rows.Err()
}

// Create records a new rexine roll arrival. remaining starts = total.
func (s *Service) Create(ctx context.Context, in CreateRollInput, actorID uuid.UUID, actorRole, ip string) (*Roll, error) {
	in.RollCode = strings.TrimSpace(in.RollCode)
	in.Color = strings.TrimSpace(in.Color)
	if in.RollCode == "" || in.Color == "" {
		return nil, fmt.Errorf("%w: roll_code and color required", ErrInvalidInput)
	}
	if in.TotalMeters <= 0 {
		return nil, fmt.Errorf("%w: total_meters must be > 0", ErrInvalidInput)
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var r Roll
	err = tx.QueryRow(ctx, `
		INSERT INTO raw_materials (roll_code, color, total_meters, remaining_meters)
		VALUES ($1, $2, $3, $3)
		RETURNING id, roll_code, color, total_meters, remaining_meters, is_active, received_at, created_at
	`, in.RollCode, in.Color, in.TotalMeters).Scan(
		&r.ID, &r.RollCode, &r.Color, &r.TotalMeters, &r.RemainingMeters,
		&r.IsActive, &r.ReceivedAt, &r.CreatedAt,
	)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return nil, ErrDuplicateCode
		}
		return nil, fmt.Errorf("insert roll: %w", err)
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole,
		EntityType: "roll", EntityID: r.ID.String(),
		Action: audit.ActionCreate,
		After:  r,
		IP:     ip,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &r, nil
}

// Update patches a roll (color / meters correction / activate-deactivate).
func (s *Service) Update(ctx context.Context, id uuid.UUID, in UpdateRollInput, actorID uuid.UUID, actorRole, ip string) (*Roll, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Load current (locked) for validation + audit "before"
	var before Roll
	err = tx.QueryRow(ctx, `
		SELECT id, roll_code, color, total_meters, remaining_meters, is_active, received_at, created_at
		FROM raw_materials WHERE id = $1 FOR UPDATE
	`, id).Scan(&before.ID, &before.RollCode, &before.Color, &before.TotalMeters,
		&before.RemainingMeters, &before.IsActive, &before.ReceivedAt, &before.CreatedAt)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	// Apply patch over current values
	after := before
	if in.Color != nil {
		c := strings.TrimSpace(*in.Color)
		if c == "" {
			return nil, fmt.Errorf("%w: color cannot be empty", ErrInvalidInput)
		}
		after.Color = c
	}
	if in.TotalMeters != nil {
		if *in.TotalMeters <= 0 {
			return nil, fmt.Errorf("%w: total_meters must be > 0", ErrInvalidInput)
		}
		after.TotalMeters = *in.TotalMeters
	}
	if in.RemainingMeters != nil {
		if *in.RemainingMeters < 0 {
			return nil, fmt.Errorf("%w: remaining_meters cannot be negative", ErrInvalidInput)
		}
		after.RemainingMeters = *in.RemainingMeters
	}
	if after.RemainingMeters > after.TotalMeters {
		return nil, fmt.Errorf("%w: remaining cannot exceed total", ErrInvalidInput)
	}
	if in.IsActive != nil {
		after.IsActive = *in.IsActive
	}

	_, err = tx.Exec(ctx, `
		UPDATE raw_materials
		SET color = $1, total_meters = $2, remaining_meters = $3, is_active = $4
		WHERE id = $5
	`, after.Color, after.TotalMeters, after.RemainingMeters, after.IsActive, id)
	if err != nil {
		return nil, err
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole,
		EntityType: "roll", EntityID: id.String(),
		Action: audit.ActionUpdate,
		Before: before, After: after,
		IP: ip,
	}); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	after.IsLow = after.IsActive && after.RemainingMeters < LowStockMeters
	return &after, nil
}

// FinishedGoods returns packed (not yet dispatched) mats grouped by car model.
// This IS the stockyard inventory: what's ready to sell.
func (s *Service) FinishedGoods(ctx context.Context) ([]FinishedStock, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cm.id, cb.name, cm.name, cm.size_class::text, COUNT(*)
		FROM batch_units bu
		JOIN batches b     ON b.id = bu.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		WHERE bu.status = 'packed'
		GROUP BY cm.id, cb.name, cm.name, cm.size_class
		ORDER BY cb.name, cm.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []FinishedStock{}
	for rows.Next() {
		var f FinishedStock
		if err := rows.Scan(&f.CarModelID, &f.BrandName, &f.ModelName, &f.SizeClass, &f.PackedCount); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}