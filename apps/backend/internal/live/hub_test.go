package live

import (
	"bufio"
	"net"
	"net/http"
	"testing"
	"time"

	"github.com/gofiber/fiber/v2"
)

func pending(ch <-chan struct{}) bool {
	select {
	case <-ch:
		return true
	default:
		return false
	}
}

func TestHubNotify(t *testing.T) {
	h := NewHub()
	a, cancelA := h.Subscribe()
	b, cancelB := h.Subscribe()
	defer cancelB()
	h.Notify()
	h.Notify() // a burst is one note per client
	if !pending(a) || pending(a) || !pending(b) || pending(b) {
		t.Fatal("each client should have exactly one note")
	}
	cancelA()
	h.Notify()
	if pending(a) || !pending(b) || h.Clients() != 1 {
		t.Fatalf("after cancel: clients = %d", h.Clients())
	}
	h.Close()
	h.Close()
}

// The real thing over a socket: connect, save something, get the note; reads and failed writes send nothing.
func TestLiveStream(t *testing.T) {
	h := NewHub()
	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	api := app.Group("/api/v1", h.Middleware())
	api.Get("/live", h.Handler())
	api.Get("/things", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })
	api.Post("/things", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusCreated) })
	api.Post("/bad", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusConflict) })
	api.Post("/auth/refresh", func(c *fiber.Ctx) error { return c.SendStatus(fiber.StatusOK) })

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	go func() { _ = app.Listener(ln) }()
	base := "http://" + ln.Addr().String() + "/api/v1"

	res, err := http.Get(base + "/live")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = res.Body.Close() }()
	if ct := res.Header.Get("Content-Type"); ct != "text/event-stream" {
		t.Fatalf("content type %q", ct)
	}
	lines := make(chan string, 16)
	go func() {
		sc := bufio.NewScanner(res.Body)
		for sc.Scan() {
			if sc.Text() != "" {
				lines <- sc.Text()
			}
		}
		close(lines)
	}()
	next := func(want string) {
		t.Helper()
		select {
		case got, ok := <-lines:
			if !ok || got != want {
				t.Fatalf("stream line = %q (open %v), want %q", got, ok, want)
			}
		case <-time.After(3 * time.Second):
			t.Fatalf("no %q within 3 s", want)
		}
	}
	call := func(method, path string) {
		t.Helper()
		req, _ := http.NewRequest(method, base+path, nil)
		r, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		_ = r.Body.Close()
	}

	next(": connected")
	if h.Clients() != 1 {
		t.Fatalf("clients = %d", h.Clients())
	}
	// None of these is a saved change…
	call(http.MethodGet, "/things")
	call(http.MethodPost, "/bad")
	call(http.MethodPost, "/auth/refresh")
	// …this one is, and it must be the first note on the line.
	call(http.MethodPost, "/things")
	next("data: changed")
	select {
	case l := <-lines:
		t.Fatalf("unexpected extra line %q", l)
	case <-time.After(200 * time.Millisecond):
	}

	// Shutdown ends the line.
	h.Close()
	select {
	case _, ok := <-lines:
		if ok {
			t.Fatal("line should have ended")
		}
	case <-time.After(3 * time.Second):
		t.Fatal("line still open after Close")
	}
	_ = app.ShutdownWithTimeout(2 * time.Second)
	if h.Clients() != 0 {
		t.Fatalf("clients after close = %d", h.Clients())
	}
}
