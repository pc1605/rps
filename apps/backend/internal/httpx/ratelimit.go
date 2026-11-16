package httpx

import (
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// LoginWindow is how long failed logins count against an address.
const LoginWindow = 15 * time.Minute

// LoginLimiter stops guessing at a login route: after maxFailures failed tries from one address
// within LoginWindow, further tries get 429 `too_many_attempts` (with Retry-After) until the window
// ends. Successful logins don't count. Each call returns a limiter with its own counters — mount
// one per login route.
//
// Counters live in this process's memory, which is right while there is one backend instance (D43).
// Behind a host's proxy, PROXY_HEADER must name the header carrying the real client address, or
// everyone shares the proxy's address.
func LoginLimiter(maxFailures int) fiber.Handler {
	return newLoginLimiter(maxFailures, LoginWindow, time.Now).handle
}

type loginLimiter struct {
	max    int
	window time.Duration
	now    func() time.Time

	mu      sync.Mutex
	entries map[string]*loginTries
}

type loginTries struct {
	count int       // failed tries, plus tries still being checked
	until time.Time // when the count is forgotten
}

func newLoginLimiter(maxFailures int, window time.Duration, now func() time.Time) *loginLimiter {
	return &loginLimiter{max: maxFailures, window: window, now: now, entries: map[string]*loginTries{}}
}

func (l *loginLimiter) handle(c *fiber.Ctx) error {
	key := c.IP()

	// Count the try before it runs, so a burst of parallel guesses can't all slip past the check.
	l.mu.Lock()
	now := l.now()
	e := l.entries[key]
	if e != nil && !now.Before(e.until) {
		e = nil
	}
	if e == nil {
		l.forgetExpired(now)
		e = &loginTries{until: now.Add(l.window)}
		l.entries[key] = e
	}
	if e.count >= l.max {
		wait := int(e.until.Sub(now).Seconds()) + 1
		l.mu.Unlock()
		c.Set(fiber.HeaderRetryAfter, strconv.Itoa(wait))
		return Error(c, fiber.StatusTooManyRequests, "too_many_attempts", "too many failed tries — wait a few minutes and try again")
	}
	e.count++
	l.mu.Unlock()

	err := c.Next()

	// A successful login gives its try back.
	if err == nil && c.Response().StatusCode() < fiber.StatusBadRequest {
		l.mu.Lock()
		if e.count > 0 {
			e.count--
		}
		l.mu.Unlock()
	}
	return err
}

// forgetExpired drops finished windows so the map can't grow without bound. Called with mu held.
func (l *loginLimiter) forgetExpired(now time.Time) {
	for key, e := range l.entries {
		if !now.Before(e.until) {
			delete(l.entries, key)
		}
	}
}
