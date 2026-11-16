package httpx

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

// Failed logins count, successful ones don't, the limit answers 429 too_many_attempts with
// Retry-After, and the count is forgotten when the window ends.
func TestLoginLimiter(t *testing.T) {
	clock := time.Now()
	limiter := newLoginLimiter(3, LoginWindow, func() time.Time { return clock })
	app := fiber.New()
	app.Post("/login", limiter.handle, func(c *fiber.Ctx) error {
		if c.Query("ok") == "1" {
			return OK(c, "in")
		}
		return Unauthorized(c, "wrong")
	})
	post := func(url string) *http.Response {
		t.Helper()
		res, err := app.Test(httptest.NewRequest(http.MethodPost, url, nil), -1)
		if err != nil {
			t.Fatal(err)
		}
		return res
	}
	status := func(url string) int {
		t.Helper()
		res := post(url)
		_ = res.Body.Close()
		return res.StatusCode
	}

	// Successful logins never use up the allowance.
	for i := range 5 {
		if got := status("/login?ok=1"); got != http.StatusOK {
			t.Fatalf("good login %d: status %d", i+1, got)
		}
	}
	for i := range 3 {
		if got := status("/login"); got != http.StatusUnauthorized {
			t.Fatalf("wrong login %d: status %d, want 401", i+1, got)
		}
	}

	// The 4th failed try is refused — and so is a correct one, until the window ends.
	res := post("/login")
	defer func() { _ = res.Body.Close() }()
	var body ErrorBody
	_ = json.NewDecoder(res.Body).Decode(&body)
	if res.StatusCode != http.StatusTooManyRequests || body.Code != "too_many_attempts" {
		t.Fatalf("over the limit: status %d code %q, want 429 too_many_attempts", res.StatusCode, body.Code)
	}
	if res.Header.Get("Retry-After") == "" {
		t.Error("over the limit: no Retry-After header")
	}
	if got := status("/login?ok=1"); got != http.StatusTooManyRequests {
		t.Errorf("good login while blocked: status %d, want 429", got)
	}

	// After the window the address starts fresh.
	clock = clock.Add(LoginWindow)
	if got := status("/login?ok=1"); got != http.StatusOK {
		t.Errorf("good login after the window: status %d, want 200", got)
	}
	if got := status("/login"); got != http.StatusUnauthorized {
		t.Errorf("wrong login after the window: status %d, want 401", got)
	}
}
