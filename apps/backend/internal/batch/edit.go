package batch

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

// ErrNotEditable: the batch has left the open cutting queue (claimed, cut, cancelled …).
var ErrNotEditable = errors.New("this batch can only be edited while it is waiting to be cut")

// EditInput is PATCH /batches/:id. A nil field is left unchanged; roll_id "" clears the roll.
type EditInput struct {
	CarModelID *int    `json:"car_model_id,omitempty"`
	Quantity   *int    `json:"quantity,omitempty"`
	RollID     *string `json:"roll_id,omitempty"`
	Notes      *string `json:"notes,omitempty"`
}

type editSnapshot struct {
	CarModelID int        `json:"car_model_id"`
	Quantity   int        `json:"quantity"`
	RollID     *uuid.UUID `json:"roll_id,omitempty"`
	Notes      string     `json:"notes"`
}

// Edit changes a batch before cutting (U3, D34): only while current_phase=cutting and
// status=pending, i.e. nobody holds the cutting claim. Once some mats are cut (a re-cut after a
// short cut, or spares reused at creation) the car item is fixed and the quantity must stay above
// cut_qty. A quantity change adds or removes the highest-numbered (uncut) units.
func (s *Service) Edit(ctx context.Context, batchID uuid.UUID, in EditInput, actorID uuid.UUID, actorRole, ip string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var (
		code   string
		phase  Phase
		status Status
		cutQty int
		before editSnapshot
	)
	err = tx.QueryRow(ctx, `
		SELECT batch_code, current_phase, status, cut_qty, car_model_id, quantity, roll_id, COALESCE(notes,'')
		FROM batches WHERE id = $1 FOR UPDATE`, batchID).
		Scan(&code, &phase, &status, &cutQty, &before.CarModelID, &before.Quantity, &before.RollID, &before.Notes)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if phase != PhaseCutting || status != StatusPending {
		return ErrNotEditable
	}

	after := before
	if in.CarModelID != nil && *in.CarModelID != before.CarModelID {
		if cutQty > 0 {
			return fmt.Errorf("%w: %d mats are already cut — the car can't change", ErrInvalidInput, cutQty)
		}
		var ok bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM car_models WHERE id = $1)`, *in.CarModelID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("%w: car_model_id %d does not exist", ErrInvalidInput, *in.CarModelID)
		}
		after.CarModelID = *in.CarModelID
	}
	if in.Quantity != nil {
		if *in.Quantity <= 0 {
			return fmt.Errorf("%w: quantity must be at least 1", ErrInvalidInput)
		}
		if *in.Quantity <= cutQty {
			return fmt.Errorf("%w: %d mats are already cut — quantity must be more than that", ErrInvalidInput, cutQty)
		}
		after.Quantity = *in.Quantity
	}
	if in.RollID != nil {
		if strings.TrimSpace(*in.RollID) == "" {
			after.RollID = nil
		} else {
			parsed, err := uuid.Parse(*in.RollID)
			if err != nil {
				return fmt.Errorf("%w: bad roll_id", ErrInvalidInput)
			}
			var ok bool
			if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM material_lots WHERE id = $1 AND is_active)`, parsed).Scan(&ok); err != nil {
				return err
			}
			if !ok {
				return fmt.Errorf("%w: roll not found or inactive", ErrInvalidInput)
			}
			after.RollID = &parsed
		}
	}
	if in.Notes != nil {
		after.Notes = strings.TrimSpace(*in.Notes)
	}

	changed := map[string]bool{
		"car_model_id": after.CarModelID != before.CarModelID,
		"quantity":     after.Quantity != before.Quantity,
		"roll_id":      !sameUUID(after.RollID, before.RollID),
		"notes":        after.Notes != before.Notes,
	}
	var fields []string
	for _, f := range []string{"car_model_id", "quantity", "roll_id", "notes"} {
		if changed[f] {
			fields = append(fields, f)
		}
	}
	if len(fields) == 0 {
		return tx.Commit(ctx) // nothing to change: no event, no audit
	}

	if _, err := tx.Exec(ctx, `
		UPDATE batches SET car_model_id = $1, quantity = $2, roll_id = $3, notes = NULLIF($4,''), version = version + 1
		WHERE id = $5`, after.CarModelID, after.Quantity, after.RollID, after.Notes, batchID); err != nil {
		return err
	}
	// Units are numbered 1..quantity; the cut ones are the lowest numbers (short-cut convention).
	switch {
	case after.Quantity > before.Quantity:
		if _, err := tx.Exec(ctx, `
			INSERT INTO batch_units (batch_id, unit_code, unit_number)
			SELECT $1, $2 || '-' || LPAD(gs.n::TEXT, 3, '0'), gs.n FROM generate_series($3::int, $4::int) AS gs(n)`,
			batchID, code, before.Quantity+1, after.Quantity); err != nil {
			return fmt.Errorf("add units: %w", err)
		}
	case after.Quantity < before.Quantity:
		if _, err := tx.Exec(ctx, `DELETE FROM batch_units WHERE batch_id = $1 AND unit_number > $2`, batchID, after.Quantity); err != nil {
			return fmt.Errorf("remove units: %w", err)
		}
	}

	if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: EvEdited, UserID: uid(actorID),
		Data: map[string]any{"fields": fields, "before": before, "after": after}}); err != nil {
		return err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole,
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionUpdate, Before: before, After: after, IP: ip,
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func sameUUID(a, b *uuid.UUID) bool {
	if a == nil || b == nil {
		return a == nil && b == nil
	}
	return *a == *b
}
