package worker

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// Enrollment: the code works once, for 10 minutes, only with the right PIN, and dies after 5 wrong PINs.
func TestEnrollmentCode(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool)
	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T enroll %d", time.Now().UnixNano()), Station: "packer", PIN: "4321"}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatalf("create worker: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, w.ID) })
	newCode := func() string {
		t.Helper()
		code, expires, err := s.NewEnrollmentCode(ctx, w.ID, adminID, "owner", "127.0.0.1")
		if err != nil {
			t.Fatalf("enrollment code: %v", err)
		}
		if len(code) != 6 {
			t.Fatalf("code %q: want 6 digits", code)
		}
		if left := time.Until(expires); left < 9*time.Minute || left > 11*time.Minute {
			t.Fatalf("expires in %v, want about 10 minutes", left)
		}
		return code
	}
	login := func(code, pin string) (int, error) {
		_, session, err := s.Login(ctx, code, pin, "127.0.0.1")
		return session, err
	}

	// The code itself is never stored.
	code := newCode()
	var stored string
	if err := pool.QueryRow(ctx, `SELECT enroll_code_hash FROM workers WHERE id = $1`, w.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored == code || stored != hashEnrollCode(code) {
		t.Errorf("stored %q for code %q: want only the hash", stored, code)
	}

	// Wrong PIN fails and leaves the code usable; the right PIN signs in; the code then is used up.
	if _, err := login(code, "0000"); !errors.Is(err, ErrInvalidLogin) {
		t.Errorf("wrong pin: %v", err)
	}
	if session, err := login(code, "4321"); err != nil || session != 1 {
		t.Fatalf("first login: session %d, %v", session, err)
	}
	if _, err := login(code, "4321"); !errors.Is(err, ErrInvalidLogin) {
		t.Errorf("code used twice: %v", err)
	}

	// A new code replaces the one before it, and every sign-in raises the session number.
	old := newCode()
	code = newCode()
	if _, err := login(old, "4321"); !errors.Is(err, ErrInvalidLogin) {
		t.Errorf("replaced code still works: %v", err)
	}
	if session, err := login(code, "4321"); err != nil || session != 2 {
		t.Errorf("second login: session %d, %v", session, err)
	}

	// Expired.
	code = newCode()
	if _, err := pool.Exec(ctx, `UPDATE workers SET enroll_expires_at = NOW() - INTERVAL '1 second' WHERE id = $1`, w.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := login(code, "4321"); !errors.Is(err, ErrInvalidLogin) {
		t.Errorf("expired code: %v", err)
	}

	// Five wrong PINs kill the code — the right PIN no longer helps.
	code = newCode()
	for i := 0; i < maxEnrollTries; i++ {
		if _, err := login(code, "0000"); !errors.Is(err, ErrInvalidLogin) {
			t.Fatalf("wrong pin %d: %v", i+1, err)
		}
	}
	if _, err := login(code, "4321"); !errors.Is(err, ErrInvalidLogin) {
		t.Errorf("code alive after %d wrong pins: %v", maxEnrollTries, err)
	}

	// No code for a deactivated worker, and a waiting code stops working on deactivation.
	code = newCode()
	no := false
	if _, err := s.Update(ctx, w.ID, UpdateInput{IsActive: &no}, adminID, "owner", "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	if _, err := login(code, "4321"); !errors.Is(err, ErrInvalidLogin) {
		t.Errorf("deactivated worker signs in: %v", err)
	}
	if _, _, err := s.NewEnrollmentCode(ctx, w.ID, adminID, "owner", "127.0.0.1"); !errors.Is(err, ErrNotFound) {
		t.Errorf("code for deactivated worker: %v", err)
	}
}

// One phone per worker: signing in on a second phone signs the first one out.
func TestOnePhonePerWorker(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool)
	authSvc := auth.NewService(pool, "test-access-secret", "test-refresh-secret", time.Hour, time.Hour)
	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T phones %d", time.Now().UnixNano()), Station: "packer", PIN: "4321"}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatalf("create worker: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, w.ID) })

	app := fiber.New()
	api := app.Group("/api/v1", authSvc.Guard())
	RegisterRoutes(api, s, authSvc)

	signIn := func() string {
		t.Helper()
		code, _, err := s.NewEnrollmentCode(ctx, w.ID, adminID, "owner", "127.0.0.1")
		if err != nil {
			t.Fatalf("enrollment code: %v", err)
		}
		body, _ := json.Marshal(map[string]string{"code": code, "pin": "4321"})
		req := httptest.NewRequest(http.MethodPost, "/api/v1/worker/login", bytes.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		res, err := app.Test(req, -1)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = res.Body.Close() }()
		var out struct {
			Data struct {
				Tokens struct {
					AccessToken string `json:"access_token"`
				} `json:"tokens"`
			} `json:"data"`
		}
		if err := json.NewDecoder(res.Body).Decode(&out); err != nil || res.StatusCode != http.StatusOK || out.Data.Tokens.AccessToken == "" {
			t.Fatalf("login: status %d, %v", res.StatusCode, err)
		}
		return out.Data.Tokens.AccessToken
	}
	me := func(token string) (int, string) {
		t.Helper()
		req := httptest.NewRequest(http.MethodGet, "/api/v1/worker/me", nil)
		req.Header.Set("Authorization", "Bearer "+token)
		res, err := app.Test(req, -1)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = res.Body.Close() }()
		var out struct {
			Code string `json:"code"`
		}
		_ = json.NewDecoder(res.Body).Decode(&out)
		return res.StatusCode, out.Code
	}

	// A token from before this rule carries no session number and works until the next sign-in.
	legacy, err := authSvc.IssueWorkerToken(w.ID, "packer", 0)
	if err != nil {
		t.Fatal(err)
	}
	if status, _ := me(legacy.AccessToken); status != http.StatusOK {
		t.Errorf("legacy token before any sign-in: %d", status)
	}

	first := signIn()
	if status, _ := me(first); status != http.StatusOK {
		t.Errorf("first phone: %d", status)
	}
	if status, code := me(legacy.AccessToken); status != http.StatusUnauthorized || code != "signed_in_elsewhere" {
		t.Errorf("legacy token after a sign-in: %d %q", status, code)
	}

	second := signIn()
	if status, _ := me(second); status != http.StatusOK {
		t.Errorf("second phone: %d", status)
	}
	if status, code := me(first); status != http.StatusUnauthorized || code != "signed_in_elsewhere" {
		t.Errorf("first phone after the second signed in: %d %q", status, code)
	}
}

// The "Set up phone" dialog's status: live code with tries left, then nothing live once the code is
// used (last sign-in moves) or blocked by wrong PINs (it doesn't).
func TestEnrollmentStatus(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	s := NewService(pool)
	var adminID uuid.UUID
	if err := pool.QueryRow(ctx, `SELECT id FROM users LIMIT 1`).Scan(&adminID); err != nil {
		t.Fatal(err)
	}
	w, err := s.Create(ctx, CreateInput{Name: fmt.Sprintf("T enroll status %d", time.Now().UnixNano()), Station: "packer", PIN: "4321"}, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatalf("create worker: %v", err)
	}
	t.Cleanup(func() { _, _ = pool.Exec(ctx, `DELETE FROM workers WHERE id = $1`, w.ID) })
	status := func() *EnrollmentStatus {
		t.Helper()
		st, err := s.GetEnrollmentStatus(ctx, w.ID)
		if err != nil {
			t.Fatalf("status: %v", err)
		}
		return st
	}

	if st := status(); st.ExpiresAt != nil || st.LastLoginAt != nil {
		t.Errorf("new worker: %+v, want no code and no sign-in", st)
	}

	code, expires, err := s.NewEnrollmentCode(ctx, w.ID, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	if st := status(); st.ExpiresAt == nil || !st.ExpiresAt.Equal(expires) || st.TriesLeft != maxEnrollTries {
		t.Errorf("waiting code: %+v, want expiry %v and %d tries", st, expires, maxEnrollTries)
	}
	if _, _, err := s.Login(ctx, code, "0000", "127.0.0.1"); !errors.Is(err, ErrInvalidLogin) {
		t.Fatal(err)
	}
	if st := status(); st.TriesLeft != maxEnrollTries-1 {
		t.Errorf("after a wrong pin: %d tries left", st.TriesLeft)
	}
	if _, _, err := s.Login(ctx, code, "4321", "127.0.0.1"); err != nil {
		t.Fatal(err)
	}
	used := status()
	if used.ExpiresAt != nil || used.LastLoginAt == nil || used.LastLoginAt.Before(expires.Add(-EnrollCodeTTL)) {
		t.Errorf("used code: %+v, want no code and a sign-in after it was made", used)
	}

	code, _, err = s.NewEnrollmentCode(ctx, w.ID, adminID, "owner", "127.0.0.1")
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < maxEnrollTries; i++ {
		_, _, _ = s.Login(ctx, code, "0000", "127.0.0.1")
	}
	if st := status(); st.ExpiresAt != nil || st.LastLoginAt == nil || !st.LastLoginAt.Equal(*used.LastLoginAt) {
		t.Errorf("blocked code: %+v, want no code and the same last sign-in", st)
	}

	if _, err := s.GetEnrollmentStatus(ctx, uuid.New()); !errors.Is(err, ErrNotFound) {
		t.Errorf("unknown worker: %v", err)
	}
}
