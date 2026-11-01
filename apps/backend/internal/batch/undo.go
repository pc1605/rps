package batch

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

const EvScanUndone EventKind = "scan_undone"

// ErrCantUndo: the scan can't be undone (reason in the wrapped message).
var ErrCantUndo = errors.New("can't undo this scan")

// UndoResult says what was undone.
type UndoResult struct {
	UnitCode  string    `json:"unit_code"`
	BatchID   uuid.UUID `json:"batch_id"`
	BatchCode string    `json:"batch_code"`
	Scan      string    `json:"scan"`       // "stitch" | "pack"
	MovedBack bool      `json:"moved_back"` // the batch went back a stage (stitching / packing)
	Phase     Phase     `json:"phase"`      // batch phase after the undo
}

func cantUndo(format string, a ...any) error {
	return fmt.Errorf("%w: %s", ErrCantUndo, fmt.Sprintf(format, a...))
}

// UndoScan reverses a mat's latest stitch or pack scan (owner/supervisor only, U3 — D38).
// Pack: the mat goes back to pending; if that pack completed the batch, the batch returns to
// packing (nothing comes after completion except dispatch, which blocks the undo). Stitch: the mat
// is unstitched; if the batch has moved on to packing, it returns to stitching only when nothing has
// happened in packing yet (no packer joined, nothing packed). Logs closed by the stage completion
// are reopened so the same workers carry on. Refused while the mat is in rework, after a rework fix,
// for written-off / spare mats, and for spares that came in stitched (their stitch was on another batch).
func (s *Service) UndoScan(ctx context.Context, unitCode, reason string, actorID uuid.UUID, actorRole, ip string) (*UndoResult, error) {
	if reason == "" {
		return nil, fmt.Errorf("%w: give a reason for the undo", ErrInvalidInput)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var (
		unitID      uuid.UUID
		status      UnitStatus
		stitchedAt  *time.Time
		stitchedBy  *uuid.UUID
		packedAt    *time.Time
		packedBy    *uuid.UUID
		prestitched bool
		batchID     uuid.UUID
		batchCode   string
		phase       Phase
		bStatus     Status
	)
	err = tx.QueryRow(ctx, `
		SELECT bu.id, bu.status, bu.stitched_at, bu.stitched_by, bu.packed_at, bu.packed_by, bu.prestitched,
		       b.id, b.batch_code, b.current_phase, b.status
		FROM batch_units bu JOIN batches b ON b.id = bu.batch_id
		WHERE bu.unit_code = $1 FOR UPDATE OF b, bu`, unitCode).
		Scan(&unitID, &status, &stitchedAt, &stitchedBy, &packedAt, &packedBy, &prestitched, &batchID, &batchCode, &phase, &bStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrUnitNotFound
	}
	if err != nil {
		return nil, err
	}
	res := &UndoResult{UnitCode: unitCode, BatchID: batchID, BatchCode: batchCode, Phase: phase}

	switch {
	case bStatus == StatusCancelled:
		return nil, cantUndo("the batch is cancelled")
	case status == UnitRework:
		return nil, cantUndo("the mat is in rework — finish or decide the rework first")
	case status == UnitDefective:
		return nil, cantUndo("the mat is written off")
	case status == UnitSpare:
		return nil, cantUndo("the mat is spare stock")
	case status == UnitDispatched:
		return nil, cantUndo("the mat has been dispatched")
	}

	var worker *uuid.UUID
	var scannedAt *time.Time
	var ev Event
	if status == UnitPacked {
		res.Scan, worker, scannedAt = "pack", packedBy, packedAt
		if phase == PhaseCompleted {
			var dispatched int
			if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM batch_units WHERE batch_id = $1 AND status = 'dispatched'`, batchID).Scan(&dispatched); err != nil {
				return nil, err
			}
			if dispatched > 0 {
				return nil, cantUndo("mats of this batch have been dispatched")
			}
		} else if phase != PhasePacking {
			return nil, cantUndo("the batch is not in packing")
		}
		if _, err := tx.Exec(ctx, `UPDATE batch_units SET status = 'pending', packed_by = NULL, packed_at = NULL WHERE id = $1`, unitID); err != nil {
			return nil, err
		}
		if phase == PhaseCompleted {
			if err := moveBack(ctx, tx, batchID, PhasePacking); err != nil {
				return nil, err
			}
			res.MovedBack, res.Phase = true, PhasePacking
			ev = Event{FromPhase: PhaseCompleted, ToPhase: PhasePacking, FromStatus: bStatus, ToStatus: StatusInProgress}
		}
	} else {
		if stitchedAt == nil {
			return nil, cantUndo("the mat hasn't been scanned yet")
		}
		if prestitched {
			return nil, cantUndo("this spare came in already stitched — its stitch belongs to another batch")
		}
		var fixed int
		if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM rework_logs WHERE unit_id = $1 AND fixed_at IS NOT NULL`, unitID).Scan(&fixed); err != nil {
			return nil, err
		}
		if fixed > 0 {
			return nil, cantUndo("the mat went through rework after this stitch")
		}
		res.Scan, worker, scannedAt = "stitch", stitchedBy, stitchedAt
		switch phase {
		case PhaseStitching:
		case PhasePacking:
			var packed, packLogs int
			if err := tx.QueryRow(ctx, `
				SELECT (SELECT COUNT(*) FROM batch_units WHERE batch_id = $1 AND status IN ('packed','dispatched')),
				       (SELECT COUNT(*) FROM phase_logs WHERE batch_id = $1 AND phase = 'packing')`, batchID).Scan(&packed, &packLogs); err != nil {
				return nil, err
			}
			if bStatus != StatusPending || packed > 0 || packLogs > 0 {
				return nil, cantUndo("packing has started on this batch")
			}
		default:
			return nil, cantUndo("the batch has left stitching")
		}
		if _, err := tx.Exec(ctx, `UPDATE batch_units SET stitched_by = NULL, stitched_at = NULL WHERE id = $1`, unitID); err != nil {
			return nil, err
		}
		if phase == PhasePacking {
			if err := moveBack(ctx, tx, batchID, PhaseStitching); err != nil {
				return nil, err
			}
			res.MovedBack, res.Phase = true, PhaseStitching
			ev = Event{FromPhase: PhasePacking, ToPhase: PhaseStitching, FromStatus: bStatus, ToStatus: StatusInProgress}
		}
	}

	ev.BatchID, ev.Kind, ev.UserID = batchID, EvScanUndone, uid(actorID)
	ev.Data = map[string]any{"unit_code": unitCode, "scan": res.Scan, "worker_id": worker, "scanned_at": scannedAt,
		"reason": reason, "moved_back": res.MovedBack}
	if err := writeEvent(ctx, tx, ev); err != nil {
		return nil, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole,
		EntityType: "batch_unit", EntityID: unitID.String(),
		Action: audit.ActionTransition,
		Before: map[string]any{"status": status, "stitched_by": stitchedBy, "stitched_at": stitchedAt, "packed_by": packedBy, "packed_at": packedAt},
		After:  map[string]any{"event": "scan_undone", "unit_code": unitCode, "scan": res.Scan, "reason": reason, "moved_back": res.MovedBack},
		IP:     ip,
	}); err != nil {
		return nil, err
	}
	return res, tx.Commit(ctx)
}

// moveBack returns a batch to `to` (stitching or packing), in progress, and reopens that phase's
// logs that the stage completion closed (they all share its completed_at).
func moveBack(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, to Phase) error {
	if _, err := tx.Exec(ctx, `
		UPDATE phase_logs SET completed_at = NULL, quantity_completed = NULL
		WHERE batch_id = $1 AND phase = $2 AND completed_at = (
		  SELECT MAX(completed_at) FROM phase_logs WHERE batch_id = $1 AND phase = $2)`, batchID, to); err != nil {
		return fmt.Errorf("reopen logs: %w", err)
	}
	_, err := tx.Exec(ctx, `UPDATE batches SET current_phase = $2, status = 'in_progress', version = version + 1 WHERE id = $1`, batchID, to)
	return err
}
