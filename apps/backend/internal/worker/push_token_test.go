package worker

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// N1: the phone saves its notification address; signing out or signing in on another phone removes it.
func TestPushToken(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool)
	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T push %d", time.Now().UnixNano()), Station: "stitcher", PIN: "4321"}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, w.ID) })
	stored := func() (token *string, lang string) {
		t.Helper()
		if err := pool.QueryRow(ctx, `SELECT push_token, push_lang FROM workers WHERE id = $1`, w.ID).Scan(&token, &lang); err != nil {
			t.Fatal(err)
		}
		return token, lang
	}

	for _, bad := range []struct{ token, lang string }{{"", "en"}, {"tok", "fr"}, {"tok", ""}} {
		if err := s.SetPushToken(ctx, w.ID, bad.token, bad.lang); !errors.Is(err, ErrInvalidInput) {
			t.Errorf("token %q lang %q: %v, want ErrInvalidInput", bad.token, bad.lang, err)
		}
	}
	if err := s.SetPushToken(ctx, uuid.New(), "tok", "en"); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown worker: %v", err)
	}

	if err := s.SetPushToken(ctx, w.ID, " tok-1 ", "hi"); err != nil {
		t.Fatal(err)
	}
	if tok, lang := stored(); tok == nil || *tok != "tok-1" || lang != "hi" {
		t.Errorf("saved %v %q", tok, lang)
	}

	if err := s.ClearPushToken(ctx, w.ID); err != nil {
		t.Fatal(err)
	}
	if tok, _ := stored(); tok != nil {
		t.Errorf("after sign-out: %v", *tok)
	}

	// Signing in on another phone: the old phone's address is dropped until the new phone sends its own.
	if err := s.SetPushToken(ctx, w.ID, "tok-old-phone", "en"); err != nil {
		t.Fatal(err)
	}
	code, _, err := s.NewEnrollmentCode(ctx, w.ID, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := s.Login(ctx, code, "4321", "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	if tok, _ := stored(); tok != nil {
		t.Errorf("after sign-in on another phone: %v", *tok)
	}
}
