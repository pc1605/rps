package batch

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

const UnitSpare UnitStatus = "spare"

var (
	ErrNotCancellable = errors.New("this batch can't be cancelled")
	ErrUnitSpare      = errors.New("this mat is spare stock from a cancelled batch — keep it aside")
)

// CancelReasonLabel: why a batch is cancelled. Mirrors CANCEL_REASON_LABEL in @rps/shared.
var CancelReasonLabel = map[string]string{
	"order_cancelled":    "Order cancelled",
	"order_changed":      "Order changed",
	"created_by_mistake": "Created by mistake",
	"material_problem":   "Material problem",
	"other":              "Other",
}

// CancelOutcome is what cancelling does (or did) to the batch's mats (D35).
type CancelOutcome struct {
	SpareStitched     int    `json:"spare_stitched"`   // stitched mats → spare stock, keep their code
	SpareUnstitched   int    `json:"spare_unstitched"` // cut, not yet stitched → spare stock
	Removed           int    `json:"removed"`          // never cut → deleted
	WrittenOff        int    `json:"written_off"`      // in open rework → written off
	AlreadyWrittenOff int    `json:"already_written_off"`
	Blocked           string `json:"blocked,omitempty"` // non-empty: why it can't be cancelled
}

// cancelPlan reads the batch (locked) and works out the outcome. Units are numbered 1..quantity and
// the cut ones are the lowest numbers (short-cut convention), so unit_number <= cut_qty means cut.
func cancelPlan(ctx context.Context, tx pgx.Tx, batchID uuid.UUID) (Phase, Status, int, *CancelOutcome, error) {
	var (
		phase  Phase
		status Status
		cutQty int
	)
	err := tx.QueryRow(ctx, `SELECT current_phase, status, cut_qty FROM batches WHERE id = $1 FOR UPDATE`, batchID).
		Scan(&phase, &status, &cutQty)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", 0, nil, ErrNotFound
	}
	if err != nil {
		return "", "", 0, nil, err
	}
	var o CancelOutcome
	var packed int
	if err := tx.QueryRow(ctx, `
		SELECT COUNT(*) FILTER (WHERE status IN ('packed','dispatched')),
		       COUNT(*) FILTER (WHERE status = 'pending' AND stitched_at IS NOT NULL),
		       COUNT(*) FILTER (WHERE status = 'pending' AND stitched_at IS NULL AND unit_number <= $2),
		       COUNT(*) FILTER (WHERE status = 'pending' AND stitched_at IS NULL AND unit_number > $2),
		       COUNT(*) FILTER (WHERE status = 'rework'),
		       COUNT(*) FILTER (WHERE status = 'defective')
		FROM batch_units WHERE batch_id = $1`, batchID, cutQty).
		Scan(&packed, &o.SpareStitched, &o.SpareUnstitched, &o.Removed, &o.WrittenOff, &o.AlreadyWrittenOff); err != nil {
		return "", "", 0, nil, err
	}
	switch {
	case status == StatusCancelled:
		o.Blocked = "This batch is already cancelled."
	case status == StatusCompleted || phase == PhaseCompleted:
		o.Blocked = "This batch is completed."
	case packed > 0:
		o.Blocked = fmt.Sprintf("%d %s already packed — a batch can only be cancelled before packing starts.", packed, mats(packed))
	}
	return phase, status, cutQty, &o, nil
}

func mats(n int) string {
	if n == 1 {
		return "mat"
	}
	return "mats"
}

// CancelPreview — GET /batches/:id/cancel-preview: what Cancel would do, without doing it.
func (s *Service) CancelPreview(ctx context.Context, batchID uuid.UUID) (*CancelOutcome, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	_, _, _, o, err := cancelPlan(ctx, tx, batchID)
	return o, err
}

// Cancel stops a batch for good (owner/supervisor, U3 — D35). Allowed until the first mat is packed.
// Stitched and cut-unstitched mats become spare stock (status 'spare', kept on this batch, unit codes
// kept); never-cut units are deleted; mats in open rework are written off. Open phase logs are
// closed, assignments cleared, status = cancelled; materials already consumed stay consumed.
func (s *Service) Cancel(ctx context.Context, batchID uuid.UUID, reason, note string, actorID uuid.UUID, actorRole, ip string) (*CancelOutcome, error) {
	if _, ok := CancelReasonLabel[reason]; !ok {
		return nil, fmt.Errorf("%w: pick a reason for cancelling", ErrInvalidInput)
	}
	if reason == "other" && note == "" {
		return nil, fmt.Errorf("%w: describe the reason when it is Other", ErrInvalidInput)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	phase, status, cutQty, o, err := cancelPlan(ctx, tx, batchID)
	if err != nil {
		return nil, err
	}
	if o.Blocked != "" {
		return nil, fmt.Errorf("%w: %s", ErrNotCancellable, o.Blocked)
	}

	// Open rework rounds → written off (D35: not kept as spares).
	if _, err := tx.Exec(ctx, `
		UPDATE rework_logs SET decision = 'write_off', decided_by = $2, decided_at = NOW()
		WHERE batch_id = $1 AND fixed_at IS NULL AND (decision IS NULL OR decision = 'to_stitcher')`,
		batchID, actorID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'defective' WHERE batch_id = $1 AND status = 'rework'`, batchID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM batch_units WHERE batch_id = $1 AND status = 'pending' AND stitched_at IS NULL AND unit_number > $2`,
		batchID, cutQty); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'spare' WHERE batch_id = $1 AND status = 'pending'`, batchID); err != nil {
		return nil, err
	}

	// Close open logs. Cutting: nothing more was reported (0). Stitching/packing: per-worker counts.
	if _, err := tx.Exec(ctx, `
		UPDATE phase_logs pl SET completed_at = NOW(),
		  quantity_completed = CASE pl.phase
		    WHEN 'stitching' THEN (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = $1 AND bu.stitched_by = pl.worker_id AND NOT bu.prestitched)
		    WHEN 'packing'   THEN (SELECT COUNT(*) FROM batch_units bu WHERE bu.batch_id = $1 AND bu.packed_by = pl.worker_id)
		    ELSE 0 END,
		  notes = CONCAT_WS(E'\n', NULLIF(pl.notes,''), 'Batch cancelled')
		WHERE pl.batch_id = $1 AND pl.completed_at IS NULL`, batchID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM batch_assignments WHERE batch_id = $1`, batchID); err != nil {
		return nil, err
	}

	label := CancelReasonLabel[reason]
	if note != "" {
		label += ": " + note
	}
	if _, err := tx.Exec(ctx, `
		UPDATE batches SET status = 'cancelled', version = version + 1,
		  notes = CONCAT_WS(E'\n', NULLIF(notes,''), $2::text)
		WHERE id = $1`, batchID, "Cancelled ("+label+")"); err != nil {
		return nil, err
	}

	data := map[string]any{"reason": reason, "spare_stitched": o.SpareStitched, "spare_unstitched": o.SpareUnstitched,
		"removed": o.Removed, "written_off": o.WrittenOff}
	if note != "" {
		data["note"] = note
	}
	if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: EvCancelled, FromPhase: phase, ToPhase: phase,
		FromStatus: status, ToStatus: StatusCancelled, UserID: uid(actorID), Data: data}); err != nil {
		return nil, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole,
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		Before: map[string]any{"phase": phase, "status": status},
		After:  map[string]any{"event": "cancelled", "status": StatusCancelled, "outcome": o, "reason": reason, "note": note},
		IP:     ip,
	}); err != nil {
		return nil, err
	}
	return o, tx.Commit(ctx)
}
