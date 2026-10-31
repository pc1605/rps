package materials

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// Querier is satisfied by *pgxpool.Pool and pgx.Tx (read-only planner runs on either).
type Querier interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// MovementInput is one ledger row. LotID nil = shortfall (consume only, enforced by a DB check).
type MovementInput struct {
	LotID         *uuid.UUID
	TypeID        int
	VariantID     *int
	Kind          string // receive | consume | adjust | waste | return
	Qty           Milli  // signed
	BatchID       *uuid.UUID
	PhaseLogID    *uuid.UUID
	ActorUserID   *uuid.UUID
	ActorWorkerID *uuid.UUID
	Reason        string
}

// InsertMovement is THE way a lot's quantity changes: it writes the movement and, for a lot,
// moves qty_remaining by the same amount in the same tx (so qty_remaining = SUM(movements)).
func InsertMovement(ctx context.Context, tx pgx.Tx, m MovementInput) (uuid.UUID, error) {
	var id uuid.UUID
	err := tx.QueryRow(ctx, `
		INSERT INTO material_movements
		  (lot_id, material_type_id, variant_id, kind, qty, batch_id, phase_log_id, actor_user_id, actor_worker_id, reason)
		VALUES ($1, $2, $3, $4::movement_kind, $5::bigint::numeric / 1000, $6, $7, $8, $9, NULLIF($10, ''))
		RETURNING id`,
		m.LotID, m.TypeID, m.VariantID, m.Kind, int64(m.Qty), m.BatchID, m.PhaseLogID,
		m.ActorUserID, m.ActorWorkerID, m.Reason).Scan(&id)
	if err != nil {
		return uuid.Nil, fmt.Errorf("movement: %w", err)
	}
	if m.LotID != nil {
		if _, err := tx.Exec(ctx, `
			UPDATE material_lots SET qty_remaining = qty_remaining + ($1::bigint::numeric / 1000) WHERE id = $2`,
			int64(m.Qty), *m.LotID); err != nil {
			var pgErr *pgconn.PgError
			if errors.As(err, &pgErr) && pgErr.ConstraintName == "material_lots_qty_remaining_check" {
				return uuid.Nil, fmt.Errorf("%w: lot can't go below 0", ErrInvalid)
			}
			return uuid.Nil, fmt.Errorf("lot qty: %w", err)
		}
	}
	return id, nil
}

func isUnique(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
