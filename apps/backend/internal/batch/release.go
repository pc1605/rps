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

// ErrNoClaim: nobody holds the cutting claim on this batch.
var ErrNoClaim = errors.New("nobody is cutting this batch right now")

// ReleaseClaim frees a stuck cutting claim (U3, D37): the open cutting log is deleted (nothing was
// reported on it; the event + audit keep the record) and the batch goes back to the open cutting
// queue (cutting/pending). By the admin (userID set) or by the cutter holding it (workerID set,
// before Complete — someone else's claim is ErrNotYours).
func (s *Service) ReleaseClaim(ctx context.Context, batchID uuid.UUID, userID, workerID *uuid.UUID, actorRole, ip string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var phase Phase
	var status Status
	err = tx.QueryRow(ctx, `SELECT current_phase, status FROM batches WHERE id = $1 FOR UPDATE`, batchID).Scan(&phase, &status)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if phase != PhaseCutting {
		return ErrWrongPhase
	}

	var logID, holder uuid.UUID
	var holderName string
	var startedAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT pl.id, pl.worker_id, w.name, pl.started_at FROM phase_logs pl JOIN workers w ON w.id = pl.worker_id
		WHERE pl.batch_id = $1 AND pl.phase = 'cutting' AND pl.completed_at IS NULL`, batchID).
		Scan(&logID, &holder, &holderName, &startedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNoClaim
	}
	if err != nil {
		return err
	}
	if workerID != nil && *workerID != holder {
		return ErrNotYours
	}

	if _, err := tx.Exec(ctx, `DELETE FROM phase_logs WHERE id = $1`, logID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE batches SET status = 'pending', version = version + 1 WHERE id = $1`, batchID); err != nil {
		return err
	}

	by := "admin"
	actorID := ""
	if workerID != nil {
		by = "cutter"
		actorID = workerID.String()
	} else if userID != nil {
		actorID = userID.String()
	}
	data := map[string]any{"worker_id": holder, "worker_name": holderName, "started_at": startedAt, "by": by}
	if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: EvClaimReleased, FromPhase: PhaseCutting, ToPhase: PhaseCutting,
		FromStatus: status, ToStatus: StatusPending, UserID: userID, WorkerID: workerID, Data: data}); err != nil {
		return err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID, ActorRole: actorRole,
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		Before: map[string]any{"phase": phase, "status": status, "claimed_by": holder},
		After:  map[string]any{"event": "claim_released", "status": StatusPending, "by": by, "started_at": startedAt.Format(time.RFC3339)},
		IP:     ip,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return tx.Commit(ctx)
}
