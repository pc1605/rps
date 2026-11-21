package push

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// The request Firebase receives, and how its answers are read.
func TestFCMSend(t *testing.T) {
	var got map[string]any
	status, answer := http.StatusOK, `{"name":"projects/p/messages/1"}`
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		_ = json.Unmarshal(body, &got)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(answer))
	}))
	defer srv.Close()
	f := &FCM{client: srv.Client(), endpoint: srv.URL}
	m := Message{Token: "tok", Title: "Title", Body: "Body", Data: map[string]string{"kind": "batch", "batch_id": "b1"}}

	if err := f.Send(context.Background(), m); err != nil {
		t.Fatalf("send: %v", err)
	}
	msg, _ := got["message"].(map[string]any)
	android, _ := msg["android"].(map[string]any)
	note, _ := android["notification"].(map[string]any)
	data, _ := msg["data"].(map[string]any)
	if msg["token"] != "tok" || android["priority"] != "high" || note["channel_id"] != ChannelID || data["batch_id"] != "b1" {
		t.Errorf("request = %v", got)
	}

	status, answer = http.StatusNotFound, `{"error":{"code":404,"status":"NOT_FOUND","message":"Requested entity was not found.",
		"details":[{"@type":"type.googleapis.com/google.firebase.fcm.v1.FcmError","errorCode":"UNREGISTERED"}]}}`
	if err := f.Send(context.Background(), m); !errors.Is(err, ErrUnregistered) {
		t.Errorf("dead token: %v, want ErrUnregistered", err)
	}

	// Any other failure is an error, never a reason to forget the token.
	status, answer = http.StatusNotFound, `{"error":{"code":404,"status":"NOT_FOUND","message":"no such project"}}`
	if err := f.Send(context.Background(), m); err == nil || errors.Is(err, ErrUnregistered) {
		t.Errorf("wrong project: %v, want a plain error", err)
	}
	status, answer = http.StatusInternalServerError, `{}`
	if err := f.Send(context.Background(), m); err == nil || errors.Is(err, ErrUnregistered) {
		t.Errorf("server error: %v, want a plain error", err)
	}
}

// fakeSender records messages; tokens listed in dead come back as unregistered.
type fakeSender struct {
	mu   sync.Mutex
	sent []Message
	dead map[string]bool
}

func (f *fakeSender) Send(_ context.Context, m Message) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.dead[m.Token] {
		return ErrUnregistered
	}
	f.sent = append(f.sent, m)
	return nil
}

// Who receives what: only workers with a phone token, in their language; a dead token is forgotten.
func TestNotifierDelivery(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	sfx := time.Now().UnixNano()
	worker := func(name, token, lang string) uuid.UUID {
		t.Helper()
		var id uuid.UUID
		var tok any
		if token != "" {
			tok = token
		}
		if err := pool.QueryRow(ctx, `
			INSERT INTO workers (name, station, pin_hash, created_by, push_token, push_lang)
			VALUES ($1, 'stitcher', $2, $3, $4, $5) RETURNING id`,
			fmt.Sprintf("T push %s %d", name, sfx), "$2a$10$"+strings.Repeat("x", 53), adminID, tok, lang).Scan(&id); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, id) })
		return id
	}
	english := worker("en", "tok-en", "en")
	hindi := worker("hi", "tok-hi", "hi")
	noPhone := worker("none", "", "en")
	gone := worker("gone", "tok-gone", "en")
	inactive := worker("off", "tok-off", "en")
	if _, err := pool.Exec(ctx, `UPDATE workers SET is_active = FALSE WHERE id = $1`, inactive); err != nil {
		t.Fatal(err)
	}

	var batchID uuid.UUID
	var code, car string
	if err := pool.QueryRow(ctx, `
		SELECT b.id, b.batch_code, cb.name || ' ' || cm.name FROM batches b
		JOIN car_models cm ON cm.id = b.car_model_id JOIN car_brands cb ON cb.id = cm.brand_id LIMIT 1`).Scan(&batchID, &code, &car); err != nil {
		t.Fatalf("a seeded batch: %v", err)
	}

	sender := &fakeSender{dead: map[string]bool{"tok-gone": true}}
	n := New(pool, sender)
	n.BatchAssigned(batchID, []uuid.UUID{english, hindi, noPhone, gone, inactive})
	n.Close()

	byToken := map[string]Message{}
	for _, m := range sender.sent {
		byToken[m.Token] = m
	}
	if len(sender.sent) != 2 {
		t.Fatalf("sent %d messages, want 2 (english + hindi): %+v", len(sender.sent), sender.sent)
	}
	en, hi := byToken["tok-en"], byToken["tok-hi"]
	if en.Title != textsFor("en").batchTitle || hi.Title != textsFor("hi").batchTitle {
		t.Errorf("titles: en %q, hi %q", en.Title, hi.Title)
	}
	if want := code + " · " + car; en.Body != want || hi.Body != want {
		t.Errorf("body %q / %q, want %q", en.Body, hi.Body, want)
	}
	if en.Data["kind"] != "batch" || en.Data["batch_id"] != batchID.String() {
		t.Errorf("data = %v", en.Data)
	}
	var left *string
	if err := pool.QueryRow(ctx, `SELECT push_token FROM workers WHERE id = $1`, gone).Scan(&left); err != nil || left != nil {
		t.Errorf("dead token kept: %v %v", left, err)
	}

	// Without a sender nothing happens (notifications off).
	New(pool, nil).BatchAssigned(batchID, []uuid.UUID{english})
}
