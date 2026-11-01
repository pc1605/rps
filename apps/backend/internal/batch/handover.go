package batch

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

// Stitching hand-over (U3): move one stitcher's remaining mats to another stitcher, on one or
// more live stitching batches, in one transaction. Used by "Move remaining to…" on the batch
// page (one move) and "Hand over open work" on the worker page (one move per batch).

type HandOverMove struct {
	BatchID    uuid.UUID
	ToWorkerID uuid.UUID
}

// HandOverResult reports what moved on each batch.
type HandOverResult struct {
	BatchID   uuid.UUID `json:"batch_id"`
	BatchCode string    `json:"batch_code"`
	Moved     int       `json:"moved"` // mats moved; 0 in a shared-pile batch (helper added, nothing owned)
}

// OpenStitching is one live stitching batch a stitcher is assigned to, with what's left for them.
type OpenStitching struct {
	BatchID   uuid.UUID `json:"batch_id"`
	BatchCode string    `json:"batch_code"`
	CarName   string    `json:"car_name"`
	Quantity  int       `json:"quantity"`
	TargetQty *int      `json:"target_qty"` // nil = shared pile
	DoneQty   int       `json:"done_qty"`
	LeftQty   int       `json:"left_qty"` // quota: target − done; shared pile: unstitched mats of the batch
}

// OpenStitchingFor lists a stitcher's live stitching assignments, oldest batch first.
func (s *Service) OpenStitchingFor(ctx context.Context, workerID uuid.UUID) ([]OpenStitching, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT b.id, b.batch_code, cb.name || ' ' || cm.name, b.quantity, ba.target_qty,
		       (SELECT COUNT(*)::int FROM batch_units bu WHERE bu.batch_id = b.id AND bu.stitched_by = ba.worker_id),
		       (SELECT COUNT(*)::int FROM batch_units bu WHERE bu.batch_id = b.id AND bu.stitched_at IS NULL)
		FROM batch_assignments ba
		JOIN batches b     ON b.id = ba.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id
		JOIN car_brands cb ON cb.id = cm.brand_id
		WHERE ba.worker_id = $1 AND ba.phase = 'stitching'
		  AND b.current_phase = 'stitching' AND b.status IN ('pending', 'in_progress')
		ORDER BY b.created_at, b.id`, workerID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []OpenStitching{}
	for rows.Next() {
		var o OpenStitching
		var unstitched int
		if err := rows.Scan(&o.BatchID, &o.BatchCode, &o.CarName, &o.Quantity, &o.TargetQty, &o.DoneQty, &unstitched); err != nil {
			return nil, err
		}
		if o.TargetQty != nil {
			o.LeftQty = max(*o.TargetQty-o.DoneQty, 0)
		} else {
			o.LeftQty = unstitched
		}
		out = append(out, o)
	}
	return out, rows.Err()
}

// HandOver moves fromID's remaining stitching work on each batch to that move's stitcher.
//   - Quota batch: from keeps a target equal to what they've stitched (removed if 0); the new
//     stitcher's target grows by the rest (added if not yet assigned). The total stays = quantity.
//   - Shared-pile batch: the new stitcher is added; from is removed if they've stitched nothing.
//
// Each batch gets an `assigned` event (before/after targets + hand_over) and an audit row.
func (s *Service) HandOver(ctx context.Context, fromID uuid.UUID, moves []HandOverMove, adminID uuid.UUID, ip string) ([]HandOverResult, error) {
	if len(moves) == 0 {
		return nil, fmt.Errorf("%w: nothing to hand over", ErrInvalidInput)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var fromName string
	if err := tx.QueryRow(ctx, `SELECT name FROM workers WHERE id = $1`, fromID).Scan(&fromName); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: unknown stitcher", ErrInvalidInput)
		}
		return nil, err
	}

	seen := map[uuid.UUID]bool{}
	out := make([]HandOverResult, 0, len(moves))
	for _, m := range moves {
		if seen[m.BatchID] {
			return nil, fmt.Errorf("%w: a batch can only be handed over once per request", ErrInvalidInput)
		}
		seen[m.BatchID] = true
		if m.ToWorkerID == fromID {
			return nil, fmt.Errorf("%w: pick a different stitcher to hand over to", ErrInvalidInput)
		}
		var toName string
		err := tx.QueryRow(ctx, `SELECT name FROM workers WHERE id = $1 AND station = 'stitcher' AND is_active`,
			m.ToWorkerID).Scan(&toName)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, fmt.Errorf("%w: hand over to an active stitcher", ErrInvalidInput)
		}
		if err != nil {
			return nil, err
		}

		var code string
		var phase Phase
		var status Status
		err = tx.QueryRow(ctx, `SELECT batch_code, current_phase, status FROM batches WHERE id = $1 FOR UPDATE`,
			m.BatchID).Scan(&code, &phase, &status)
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		if err != nil {
			return nil, err
		}
		if phase != PhaseStitching || (status != StatusPending && status != StatusInProgress) {
			return nil, fmt.Errorf("%w: %s is not being stitched", ErrInvalidInput, code)
		}

		var fromTarget, toTarget *int
		var fromAssigned, toAssigned bool
		var fromDone int
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS (SELECT 1 FROM batch_assignments WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2),
			       (SELECT target_qty FROM batch_assignments WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2),
			       EXISTS (SELECT 1 FROM batch_assignments WHERE batch_id=$1 AND phase='stitching' AND worker_id=$3),
			       (SELECT target_qty FROM batch_assignments WHERE batch_id=$1 AND phase='stitching' AND worker_id=$3),
			       (SELECT COUNT(*)::int FROM batch_units WHERE batch_id=$1 AND stitched_by=$2)`,
			m.BatchID, fromID, m.ToWorkerID).Scan(&fromAssigned, &fromTarget, &toAssigned, &toTarget, &fromDone); err != nil {
			return nil, err
		}
		if !fromAssigned {
			return nil, fmt.Errorf("%w: %s is not assigned to %s", ErrInvalidInput, fromName, code)
		}

		before, err := assignmentTargets(ctx, tx, m.BatchID, PhaseStitching)
		if err != nil {
			return nil, err
		}

		moved := 0
		if fromTarget != nil { // quota batch
			moved = *fromTarget - fromDone
			if moved <= 0 {
				return nil, fmt.Errorf("%w: %s has nothing left on %s", ErrInvalidInput, fromName, code)
			}
			if toAssigned {
				if toTarget == nil { // all-or-none quotas make this unreachable; refuse rather than mix modes
					return nil, fmt.Errorf("%w: %s mixes quota and shared assignments", ErrInvalidInput, code)
				}
				if _, err := tx.Exec(ctx, `UPDATE batch_assignments SET target_qty = target_qty + $3
					WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2`, m.BatchID, m.ToWorkerID, moved); err != nil {
					return nil, err
				}
			} else if _, err := tx.Exec(ctx, `INSERT INTO batch_assignments (batch_id, phase, worker_id, assigned_by, target_qty)
				VALUES ($1, 'stitching', $2, $3, $4)`, m.BatchID, m.ToWorkerID, adminID, moved); err != nil {
				return nil, err
			}
		} else { // shared pile
			if !toAssigned {
				if _, err := tx.Exec(ctx, `INSERT INTO batch_assignments (batch_id, phase, worker_id, assigned_by)
					VALUES ($1, 'stitching', $2, $3)`, m.BatchID, m.ToWorkerID, adminID); err != nil {
					return nil, err
				}
			}
		}
		// from: keep what they've done, or drop them if they did nothing
		if fromDone == 0 {
			_, err = tx.Exec(ctx, `DELETE FROM batch_assignments WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2`,
				m.BatchID, fromID)
		} else if fromTarget != nil {
			_, err = tx.Exec(ctx, `UPDATE batch_assignments SET target_qty=$3 WHERE batch_id=$1 AND phase='stitching' AND worker_id=$2`,
				m.BatchID, fromID, fromDone)
		}
		if err != nil {
			return nil, err
		}

		after, err := assignmentTargets(ctx, tx, m.BatchID, PhaseStitching)
		if err != nil {
			return nil, err
		}
		if err := writeEvent(ctx, tx, Event{BatchID: m.BatchID, Kind: EvAssigned, UserID: uid(adminID),
			Data: map[string]any{"phase": PhaseStitching, "before": before, "after": after,
				"hand_over": map[string]any{"from": fromID, "to": m.ToWorkerID, "moved": moved}}}); err != nil {
			return nil, err
		}
		if err := audit.Write(ctx, tx, audit.Entry{
			ActorID: adminID.String(), ActorRole: "admin",
			EntityType: "batch", EntityID: m.BatchID.String(),
			Action: audit.ActionTransition,
			After: map[string]any{"event": "stitching_hand_over", "from": fromID.String(),
				"to": m.ToWorkerID.String(), "moved": moved},
			IP: ip,
		}); err != nil {
			return nil, err
		}
		out = append(out, HandOverResult{BatchID: m.BatchID, BatchCode: code, Moved: moved})
	}
	return out, tx.Commit(ctx)
}
