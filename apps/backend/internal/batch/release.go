package batch

import (
	"context"
	"errors"
	"fmt"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

// ErrNoClaim: nobody holds the cutting claim on this batch.
var ErrNoClaim = errors.New("nobody is cutting this batch right now")

// GiveBackReasonLabel: why a cutter gives a batch back (D48). Mirrors GIVE_BACK_REASON_LABEL in @rps/shared.
var GiveBackReasonLabel = map[string]string{
	"machine_issue":  "Machine problem",
	"material_issue": "Material problem",
	"too_much_work":  "Too much work",
	"shift_over":     "Shift over",
	"other":          "Other",
}

// maxGiveBackNote bounds the cutter's note (the phone allows 200 characters).
const maxGiveBackNote = 500

// GivenBack: the latest cutting claim that ended without a cut (BatchDetail.given_back).
type GivenBack struct {
	WorkerID   uuid.UUID `json:"worker_id"`
	WorkerName string    `json:"worker_name"`
	At         time.Time `json:"at"`
	By         string    `json:"by"`
	Reason     string    `json:"reason,omitempty"`
	Note       string    `json:"note,omitempty"`
}

// latestGiveBack: the newest claim_released event of a batch, nil when there is none.
func (s *Service) latestGiveBack(ctx context.Context, batchID uuid.UUID) (*GivenBack, error) {
	var g GivenBack
	err := s.pool.QueryRow(ctx, `
		SELECT (data->>'worker_id')::uuid, COALESCE(data->>'worker_name', ''), at, COALESCE(data->>'by', ''),
		       COALESCE(data->>'reason', ''), COALESCE(data->>'note', '')
		FROM batch_events WHERE batch_id = $1 AND kind = 'claim_released'
		ORDER BY at DESC, id DESC LIMIT 1`, batchID).
		Scan(&g.WorkerID, &g.WorkerName, &g.At, &g.By, &g.Reason, &g.Note)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// ReleaseClaim frees a stuck cutting claim (U3, D37): the open cutting log is deleted (nothing was
// reported on it; the event + audit keep the record) and the batch goes back to the admin as
// "needs a cutter" (cutting/awaiting_assignment, cutter cleared — D48). By the admin (userID set) or by the cutter holding it (workerID set,
// before Complete — someone else's claim is ErrNotYours). A cutter gives a reason (a GiveBackReasonLabel
// code; note required for "other") so the admin knows why; the admin's release has none.
func (s *Service) ReleaseClaim(ctx context.Context, batchID uuid.UUID, userID, workerID *uuid.UUID, reason, note, actorRole, ip string) error {
	if workerID != nil {
		if _, ok := GiveBackReasonLabel[reason]; !ok {
			return fmt.Errorf("%w: pick why you are giving it back", ErrInvalidInput)
		}
		if reason == "other" && note == "" {
			return fmt.Errorf("%w: write why you are giving it back", ErrInvalidInput)
		}
		if utf8.RuneCountInString(note) > maxGiveBackNote {
			return fmt.Errorf("%w: the note is too long", ErrInvalidInput)
		}
	} else {
		reason, note = "", ""
	}
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
	if _, err := clearCutter(ctx, tx, batchID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `UPDATE batches SET status = 'awaiting_assignment', version = version + 1 WHERE id = $1`, batchID); err != nil {
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
	after := map[string]any{"event": "claim_released", "status": StatusAwaitingAssignment, "by": by, "started_at": startedAt.Format(time.RFC3339)}
	if reason != "" {
		data["reason"], after["reason"] = reason, reason
		if note != "" {
			data["note"] = note
		}
	}
	if err := writeEvent(ctx, tx, Event{BatchID: batchID, Kind: EvClaimReleased, FromPhase: PhaseCutting, ToPhase: PhaseCutting,
		FromStatus: status, ToStatus: StatusAwaitingAssignment, UserID: userID, WorkerID: workerID, Data: data}); err != nil {
		return err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID, ActorRole: actorRole,
		EntityType: "batch", EntityID: batchID.String(),
		Action: audit.ActionTransition,
		Before: map[string]any{"phase": phase, "status": status, "claimed_by": holder},
		After:  after,
		IP:     ip,
	}); err != nil {
		return fmt.Errorf("audit: %w", err)
	}
	return tx.Commit(ctx)
}
