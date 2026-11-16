package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
	"golang.org/x/crypto/bcrypt"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// The admin's refresh token lives only in an httpOnly cookie: login sets it and keeps it out of the
// body, refresh accepts nothing else, logout removes it.
func TestRefreshCookie(t *testing.T) {
	ctx := context.Background()
	pool := testutil.DB(t)
	svc := NewService(pool, "test-access-secret", "test-refresh-secret", time.Hour, 24*time.Hour)

	email := fmt.Sprintf("cookie-%d@test.local", time.Now().UnixNano())
	hash, err := bcrypt.GenerateFromPassword([]byte("a-test-password"), bcrypt.MinCost)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO users (name, email, password_hash, role) VALUES ('T cookie', $1, $2, 'supervisor')`, email, string(hash)); err != nil {
		t.Fatalf("create user: %v", err)
	}
	t.Cleanup(func() {
		time.Sleep(100 * time.Millisecond) // let login's background last_login_at update finish
		_, _ = pool.Exec(ctx, `DELETE FROM users WHERE email = $1`, email)
	})

	app := fiber.New()
	api := app.Group("/api/v1", svc.Guard())
	RegisterRoutes(api, svc, true)

	type reply struct {
		status int
		cookie *http.Cookie // the refresh cookie the server set, if any
		body   string
		access string
	}
	// refreshToken: sent as the refresh cookie when not empty.
	post := func(path, body, refreshToken string) reply {
		t.Helper()
		req := httptest.NewRequest(http.MethodPost, "/api/v1"+path, bytes.NewReader([]byte(body)))
		req.Header.Set("Content-Type", "application/json")
		if refreshToken != "" {
			req.Header.Set("Cookie", RefreshCookie+"="+refreshToken)
		}
		res, err := app.Test(req, -1)
		if err != nil {
			t.Fatal(err)
		}
		defer func() { _ = res.Body.Close() }()
		var buf bytes.Buffer
		_, _ = buf.ReadFrom(res.Body)
		out := reply{status: res.StatusCode, body: buf.String()}
		for _, ck := range res.Cookies() {
			if ck.Name == RefreshCookie {
				out.cookie = ck
			}
		}
		var parsed struct {
			Data struct {
				Tokens struct {
					AccessToken string `json:"access_token"`
				} `json:"tokens"`
			} `json:"data"`
		}
		_ = json.Unmarshal(buf.Bytes(), &parsed)
		out.access = parsed.Data.Tokens.AccessToken
		return out
	}

	// Login: access token in the body, refresh token only in the cookie.
	login := post("/auth/login", fmt.Sprintf(`{"email":%q,"password":"a-test-password"}`, email), "")
	if login.status != http.StatusOK || login.access == "" {
		t.Fatalf("login: status %d, body %s", login.status, login.body)
	}
	if strings.Contains(login.body, "refresh_token") {
		t.Error("login body still carries a refresh_token")
	}
	ck := login.cookie
	if ck == nil || ck.Value == "" {
		t.Fatal("login set no refresh cookie")
	}
	if !ck.HttpOnly || !ck.Secure || ck.SameSite != http.SameSiteStrictMode || ck.Path != "/api/v1/auth" || ck.MaxAge != 24*60*60 {
		t.Errorf("refresh cookie: httpOnly=%v secure=%v sameSite=%v path=%q maxAge=%d", ck.HttpOnly, ck.Secure, ck.SameSite, ck.Path, ck.MaxAge)
	}
	removed := func(c *http.Cookie) bool {
		return c != nil && c.Value == "" && c.Expires.Before(time.Now())
	}

	// Refresh: only the cookie counts — a token in the body (the old way) is ignored.
	if r := post("/auth/refresh", fmt.Sprintf(`{"refresh_token":%q}`, ck.Value), ""); r.status != http.StatusUnauthorized {
		t.Errorf("refresh with the token in the body: status %d, want 401", r.status)
	}
	refreshed := post("/auth/refresh", "", ck.Value)
	if refreshed.status != http.StatusOK || refreshed.access == "" {
		t.Fatalf("refresh with the cookie: status %d, body %s", refreshed.status, refreshed.body)
	}
	if strings.Contains(refreshed.body, "refresh_token") {
		t.Error("refresh body carries a refresh_token")
	}
	if refreshed.cookie == nil || refreshed.cookie.Value == "" {
		t.Error("refresh did not renew the cookie")
	}
	if _, err := svc.ParseAccessToken(refreshed.access); err != nil {
		t.Errorf("refreshed access token: %v", err)
	}

	// A bad cookie is refused and removed.
	bad := post("/auth/refresh", "", "not-a-token")
	if bad.status != http.StatusUnauthorized || !removed(bad.cookie) {
		t.Errorf("refresh with a bad cookie: status %d, cookie %+v — want 401 and the cookie removed", bad.status, bad.cookie)
	}

	// A deactivated admin can't refresh.
	if _, err := pool.Exec(ctx, `UPDATE users SET deactivated_at = NOW() WHERE email = $1`, email); err != nil {
		t.Fatal(err)
	}
	if r := post("/auth/refresh", "", ck.Value); r.status != http.StatusUnauthorized {
		t.Errorf("refresh for a deactivated admin: status %d, want 401", r.status)
	}

	// Logout needs no token and removes the cookie.
	out := post("/auth/logout", "", ck.Value)
	if out.status != http.StatusOK || !removed(out.cookie) {
		t.Errorf("logout: status %d, cookie %+v — want 200 and the cookie removed", out.status, out.cookie)
	}
}
