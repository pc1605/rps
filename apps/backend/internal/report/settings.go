package report

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

var ErrInvalid = errors.New("invalid input")

// StuckHours: a batch is stuck when nothing happened (no event, no scan) for this many hours
// in its current stage. Stored in app_settings under "stuck_hours" (migration 016).
type StuckHours struct {
	Cutting            int `json:"cutting"`
	AwaitingAssignment int `json:"awaiting_assignment"`
	Stitching          int `json:"stitching"`
	Packing            int `json:"packing"`
}

// DefaultStuckHours is used when the row is missing (the migration seeds the same values).
var DefaultStuckHours = StuckHours{Cutting: 24, AwaitingAssignment: 24, Stitching: 48, Packing: 48}

func (h StuckHours) validate() error {
	for name, v := range map[string]int{"cutting": h.Cutting, "awaiting_assignment": h.AwaitingAssignment,
		"stitching": h.Stitching, "packing": h.Packing} {
		if v < 1 || v > 720 {
			return fmt.Errorf("%w: %s must be between 1 and 720 hours", ErrInvalid, name)
		}
	}
	return nil
}

// Settings is everything GET /settings returns.
type Settings struct {
	StuckHours StuckHours `json:"stuck_hours"`
}

type querier interface {
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

func stuckHours(ctx context.Context, q querier) (StuckHours, error) {
	var raw []byte
	err := q.QueryRow(ctx, `SELECT value FROM app_settings WHERE key = 'stuck_hours'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return DefaultStuckHours, nil
	}
	if err != nil {
		return StuckHours{}, err
	}
	h := DefaultStuckHours // keys missing from the JSON keep their default
	if err := json.Unmarshal(raw, &h); err != nil {
		return StuckHours{}, fmt.Errorf("stuck_hours setting: %w", err)
	}
	return h, nil
}

func (s *Service) Settings(ctx context.Context) (*Settings, error) {
	h, err := stuckHours(ctx, s.pool)
	if err != nil {
		return nil, err
	}
	return &Settings{StuckHours: h}, nil
}

// PutStuckHours replaces the thresholds; tx + audit.
func (s *Service) PutStuckHours(ctx context.Context, in StuckHours, userID uuid.UUID, role, ip string) (*StuckHours, error) {
	if err := in.validate(); err != nil {
		return nil, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	before, err := stuckHours(ctx, tx)
	if err != nil {
		return nil, err
	}
	val, _ := json.Marshal(in)
	if _, err := tx.Exec(ctx, `
		INSERT INTO app_settings (key, value, updated_at, updated_by) VALUES ('stuck_hours', $1, NOW(), $2)
		ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = EXCLUDED.updated_by`,
		val, userID); err != nil {
		return nil, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: userID.String(), ActorRole: role, EntityType: "app_setting", EntityID: "stuck_hours",
		Action: audit.ActionUpdate, Before: before, After: in, IP: ip,
	}); err != nil {
		return nil, err
	}
	return &in, tx.Commit(ctx)
}
