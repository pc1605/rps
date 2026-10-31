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
		SELECT r.id, r.lot_code, r.color, r.qty_received, r.qty_remaining,
		       r.is_active, r.received_at, r.created_at,
		       (SELECT COUNT(*) FROM batches b WHERE b.roll_id = r.id)
		FROM material_lots r
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

// DefaultRollTypeCode is the material type a roll gets when the caller doesn't say (pre-C2 stock screen).
const DefaultRollTypeCode = "REX-R"

// Create records a new roll (a material lot) arrival: remaining starts = total, and a
// 'receive' movement is written in the same tx so qty_remaining = SUM(movements).
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

	var typeID int
	if in.MaterialTypeID != nil {
		err = tx.QueryRow(ctx, `SELECT id FROM material_types WHERE id = $1 AND is_active`, *in.MaterialTypeID).Scan(&typeID)
	} else {
		err = tx.QueryRow(ctx, `SELECT id FROM material_types WHERE code = $1`, DefaultRollTypeCode).Scan(&typeID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, fmt.Errorf("%w: material type not found or inactive", ErrInvalidInput)
	}
	if err != nil {
		return nil, err
	}

	var r Roll
	err = tx.QueryRow(ctx, `
		INSERT INTO material_lots (lot_code, color, qty_received, qty_remaining, material_type_id)
		VALUES ($1, $2, $3, $3, $4)
		RETURNING id, lot_code, color, qty_received, qty_remaining, is_active, received_at, created_at
	`, in.RollCode, in.Color, in.TotalMeters, typeID).Scan(
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
	if _, err := tx.Exec(ctx, `
		INSERT INTO material_movements (lot_id, material_type_id, kind, qty, reason, actor_user_id, created_at)
		VALUES ($1, $2, 'receive', $3, 'received', $4, $5)
	`, r.ID, typeID, in.TotalMeters, actorID, r.ReceivedAt); err != nil {
		return nil, fmt.Errorf("receive movement: %w", err)
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
	var typeID int
	var variantID *int
	err = tx.QueryRow(ctx, `
		SELECT id, lot_code, color, qty_received, qty_remaining, is_active, received_at, created_at,
		       material_type_id, variant_id
		FROM material_lots WHERE id = $1 FOR UPDATE
	`, id).Scan(&before.ID, &before.RollCode, &before.Color, &before.TotalMeters,
		&before.RemainingMeters, &before.IsActive, &before.ReceivedAt, &before.CreatedAt,
		&typeID, &variantID)
	if errors.Is(err, pgx.ErrNoRows) {
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
		UPDATE material_lots
		SET color = $1, qty_received = $2, qty_remaining = $3, is_active = $4
		WHERE id = $5
	`, after.Color, after.TotalMeters, after.RemainingMeters, after.IsActive, id)
	if err != nil {
		return nil, err
	}
	// Keep the ledger true: a manual remaining correction is an 'adjust' movement for the difference.
	// Delta computed in SQL (numeric) so float rounding can't break qty_remaining = SUM(movements).
	if _, err := tx.Exec(ctx, `
		INSERT INTO material_movements (lot_id, material_type_id, variant_id, kind, qty, reason, actor_user_id)
		SELECT $1, $2, $3, 'adjust', $4::numeric(12,3) - $5::numeric(12,3), 'manual correction (stock page)', $6
		WHERE $4::numeric(12,3) <> $5::numeric(12,3)
	`, id, typeID, variantID, after.RemainingMeters, before.RemainingMeters, actorID); err != nil {
		return nil, fmt.Errorf("adjust movement: %w", err)
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

// FinishedGoods returns packed (not yet dispatched) mats grouped by item
// (car × size × product line). This IS the stockyard inventory: what's ready to sell.
func (s *Service) FinishedGoods(ctx context.Context) ([]FinishedStock, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT cm.id, cb.name, cm.name, cm.size_class::text, pln.name, cm.barcode, COUNT(*)
		FROM batch_units bu
		JOIN batches b     ON b.id = bu.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pln ON pln.id = cm.product_line_id
		WHERE bu.status = 'packed'
		GROUP BY cm.id, cb.name, cm.name, cm.size_class, pln.name, cm.barcode
		ORDER BY cb.name, cm.name, pln.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []FinishedStock{}
	for rows.Next() {
		var f FinishedStock
		if err := rows.Scan(&f.CarModelID, &f.BrandName, &f.ModelName, &f.SizeClass,
			&f.LineName, &f.Barcode, &f.PackedCount); err != nil {
			return nil, err
		}
		out = append(out, f)
	}
	return out, rows.Err()
}
