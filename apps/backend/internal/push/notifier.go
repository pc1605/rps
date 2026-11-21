package push

import (
	"context"
	"errors"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"
)

// Notifier tells workers' phones about work that has just come to them. Its methods return at once:
// sending happens in the background after the change is saved, so a slow or failing push service
// never slows or fails the admin's request. Without a Sender (no Firebase key) it does nothing.
type Notifier struct {
	pool    *pgxpool.Pool
	sender  Sender
	timeout time.Duration
	wg      sync.WaitGroup
}

// New returns a Notifier. sender nil = notifications off.
func New(pool *pgxpool.Pool, sender Sender) *Notifier {
	return &Notifier{pool: pool, sender: sender, timeout: 20 * time.Second}
}

// Close waits for notifications still being sent (graceful shutdown).
func (n *Notifier) Close() {
	if n != nil {
		n.wg.Wait()
	}
}

// BatchAssigned: these workers were just given this batch (assignment or hand-over).
func (n *Notifier) BatchAssigned(batchID uuid.UUID, workerIDs []uuid.UUID) {
	n.background(func(ctx context.Context) error { return n.batchAssigned(ctx, batchID, workerIDs) })
}

// ReworkSent: this rework mat was just sent to this stitcher to fix.
func (n *Notifier) ReworkSent(reworkID, stitcherID uuid.UUID) {
	n.background(func(ctx context.Context) error { return n.reworkSent(ctx, reworkID, stitcherID) })
}

func (n *Notifier) background(job func(context.Context) error) {
	if n == nil || n.sender == nil {
		return
	}
	n.wg.Add(1)
	go func() {
		defer n.wg.Done()
		ctx, cancel := context.WithTimeout(context.Background(), n.timeout)
		defer cancel()
		if err := job(ctx); err != nil {
			log.Error().Err(err).Msg("push notification")
		}
	}()
}

type recipient struct {
	id    uuid.UUID
	token string
	lang  string
}

// recipients: the active workers among ids whose phone has a push token.
func (n *Notifier) recipients(ctx context.Context, ids []uuid.UUID) ([]recipient, error) {
	rows, err := n.pool.Query(ctx, `
		SELECT id, push_token, push_lang FROM workers
		WHERE id = ANY($1) AND is_active AND push_token IS NOT NULL`, ids)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []recipient
	for rows.Next() {
		var r recipient
		if err := rows.Scan(&r.id, &r.token, &r.lang); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (n *Notifier) batchAssigned(ctx context.Context, batchID uuid.UUID, workerIDs []uuid.UUID) error {
	if len(workerIDs) == 0 {
		return nil
	}
	var code, car string
	if err := n.pool.QueryRow(ctx, `
		SELECT b.batch_code, cb.name || ' ' || cm.name
		FROM batches b JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
		WHERE b.id = $1`, batchID).Scan(&code, &car); err != nil {
		return err
	}
	return n.deliver(ctx, workerIDs, func(lang string) Message {
		t := textsFor(lang)
		return Message{Title: t.batchTitle, Body: code + " · " + car,
			Data: map[string]string{"kind": "batch", "batch_id": batchID.String()}}
	})
}

func (n *Notifier) reworkSent(ctx context.Context, reworkID, stitcherID uuid.UUID) error {
	var unit, car string
	if err := n.pool.QueryRow(ctx, `
		SELECT bu.unit_code, cb.name || ' ' || cm.name
		FROM rework_logs rl JOIN batch_units bu ON bu.id = rl.unit_id JOIN batches b ON b.id = rl.batch_id
		JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id
		WHERE rl.id = $1`, reworkID).Scan(&unit, &car); err != nil {
		return err
	}
	return n.deliver(ctx, []uuid.UUID{stitcherID}, func(lang string) Message {
		t := textsFor(lang)
		return Message{Title: t.reworkTitle, Body: unit + " · " + car,
			Data: map[string]string{"kind": "rework", "rework_id": reworkID.String()}}
	})
}

// deliver sends one message per recipient; a dead token is removed so it isn't tried again.
func (n *Notifier) deliver(ctx context.Context, ids []uuid.UUID, build func(lang string) Message) error {
	rs, err := n.recipients(ctx, ids)
	if err != nil {
		return err
	}
	var errs []error
	for _, r := range rs {
		m := build(r.lang)
		m.Token = r.token
		err := n.sender.Send(ctx, m)
		switch {
		case err == nil:
		case errors.Is(err, ErrUnregistered):
			// Only if it is still the same token — the phone may have registered a new one meanwhile.
			if _, err := n.pool.Exec(ctx, `UPDATE workers SET push_token = NULL, push_token_at = NULL
				WHERE id = $1 AND push_token = $2`, r.id, r.token); err != nil {
				errs = append(errs, err)
			}
		default:
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

type texts struct{ batchTitle, reworkTitle string }

// textsFor: the notification titles in the phone's language. The body is codes and names only, the same
// in every language. Hindi lines are in docs/rps-kb/05-mobile/hindi-texts.md for the owner's review.
func textsFor(lang string) texts {
	if lang == "hi" {
		return texts{batchTitle: "📌 आपको नया बैच दिया गया", reworkTitle: "🔧 ठीक करने के लिए रीवर्क मैट"}
	}
	return texts{batchTitle: "📌 New batch assigned to you", reworkTitle: "🔧 Rework mat to fix"}
}
