package audit

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"
)

type Action string

const (
	ActionCreate     Action = "create"
	ActionUpdate     Action = "update"
	ActionDelete     Action = "delete"
	ActionTransition Action = "transition"
)

// Entry is one audit record.
type Entry struct {
	ActorID    string
	ActorRole  string
	EntityType string
	EntityID   string
	Action     Action
	Before     any
	After      any
	IP         string
	Device     string
}

// Write inserts an audit_log row using the provided transaction.
// MUST be called inside the same tx as the mutation it records.
func Write(ctx context.Context, tx pgx.Tx, e Entry) error {
	var beforeJSON, afterJSON []byte
	if e.Before != nil {
		beforeJSON, _ = json.Marshal(e.Before)
	}
	if e.After != nil {
		afterJSON, _ = json.Marshal(e.After)
	}

	var ip any
	if e.IP != "" {
		ip = e.IP
	}

	_, err := tx.Exec(ctx, `
		INSERT INTO audit_log
		  (actor_id, actor_role, entity_type, entity_id, action, before_json, after_json, ip, device)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, nullUUID(e.ActorID), e.ActorRole, e.EntityType, e.EntityID, string(e.Action),
		beforeJSON, afterJSON, ip, e.Device)
	return err
}

func nullUUID(s string) any {
	if s == "" {
		return nil
	}
	return s
}