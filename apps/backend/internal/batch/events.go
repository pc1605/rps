package batch

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// EventKind mirrors the batch_event_kind enum (migration 016).
type EventKind string

const (
	EvCreated            EventKind = "created"
	EvCutStarted         EventKind = "cut_started"
	EvCutCompleted       EventKind = "cut_completed"
	EvShortResolved      EventKind = "short_resolved"
	EvAssigned           EventKind = "assigned"
	EvStitchingStarted   EventKind = "stitching_started"
	EvStitchingCompleted EventKind = "stitching_completed"
	EvPackingStarted     EventKind = "packing_started"
	EvCompleted          EventKind = "completed"
)

// Event is one typed batch transition. Written in the SAME tx as the change it records.
type Event struct {
	BatchID    uuid.UUID
	Kind       EventKind
	FromPhase  Phase
	ToPhase    Phase
	FromStatus Status
	ToStatus   Status
	UserID     *uuid.UUID
	WorkerID   *uuid.UUID
	Data       map[string]any
}

func writeEvent(ctx context.Context, tx pgx.Tx, e Event) error {
	if e.Data == nil {
		e.Data = map[string]any{}
	}
	data, err := json.Marshal(e.Data)
	if err != nil {
		return fmt.Errorf("event data: %w", err)
	}
	nz := func(s string) *string {
		if s == "" {
			return nil
		}
		return &s
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO batch_events (batch_id, kind, from_phase, to_phase, from_status, to_status, actor_user_id, actor_worker_id, data)
		VALUES ($1, $2, $3::batch_phase, $4::batch_phase, $5::batch_status, $6::batch_status, $7, $8, $9)`,
		e.BatchID, string(e.Kind), nz(string(e.FromPhase)), nz(string(e.ToPhase)),
		nz(string(e.FromStatus)), nz(string(e.ToStatus)), e.UserID, e.WorkerID, data); err != nil {
		return fmt.Errorf("batch event %s: %w", e.Kind, err)
	}
	return nil
}

func uid(id uuid.UUID) *uuid.UUID { return &id }

// AssignmentTarget is one assignee in an `assigned` event's before/after lists (D6: quota history).
type AssignmentTarget struct {
	WorkerID  uuid.UUID `json:"worker_id"`
	TargetQty *int      `json:"target_qty,omitempty"`
}

func assignmentTargets(ctx context.Context, tx pgx.Tx, batchID uuid.UUID, phase Phase) ([]AssignmentTarget, error) {
	rows, err := tx.Query(ctx, `SELECT worker_id, target_qty FROM batch_assignments
		WHERE batch_id = $1 AND phase = $2 ORDER BY worker_id`, batchID, phase)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []AssignmentTarget{}
	for rows.Next() {
		var a AssignmentTarget
		if err := rows.Scan(&a.WorkerID, &a.TargetQty); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}
