// Package live pushes "something changed" notes to connected clients (RT1, D43).
//
// A note carries no data. The admin web and the phone keep one open line (GET /api/v1/live, server-sent
// events) and, on a note, re-read what they show through the normal endpoints — so there is one source
// of numbers and nothing sensitive on the line. Clients keep a slow poll as a fallback.
//
// The hub lives in this process. With more than one backend instance, a change saved by one instance
// would not reach clients connected to another — add Postgres LISTEN/NOTIFY here before scaling out.
package live

import (
	"bufio"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// heartbeat keeps proxies from closing a quiet line and lets the server notice a client that went away.
// Clients treat ~2 missed heartbeats as a dead line and reconnect.
const heartbeat = 25 * time.Second

type Hub struct {
	mu     sync.Mutex
	subs   map[chan struct{}]struct{}
	done   chan struct{}
	closed bool
}

func NewHub() *Hub {
	return &Hub{subs: map[chan struct{}]struct{}{}, done: make(chan struct{})}
}

// Subscribe returns a channel that receives after every Notify, and a cancel func. The channel holds
// at most one pending note: a burst of changes becomes one note (the client re-reads everything anyway).
func (h *Hub) Subscribe() (<-chan struct{}, func()) {
	ch := make(chan struct{}, 1)
	h.mu.Lock()
	h.subs[ch] = struct{}{}
	h.mu.Unlock()
	return ch, func() {
		h.mu.Lock()
		delete(h.subs, ch)
		h.mu.Unlock()
	}
}

// Notify tells every connected client that something changed. Never blocks.
func (h *Hub) Notify() {
	h.mu.Lock()
	defer h.mu.Unlock()
	for ch := range h.subs {
		select {
		case ch <- struct{}{}:
		default: // a note is already waiting for this client
		}
	}
}

// Close ends every open line (server shutdown). Safe to call more than once.
func (h *Hub) Close() {
	h.mu.Lock()
	defer h.mu.Unlock()
	if !h.closed {
		h.closed = true
		close(h.done)
	}
}

// Clients is the number of open lines.
func (h *Hub) Clients() int {
	h.mu.Lock()
	defer h.mu.Unlock()
	return len(h.subs)
}

// Middleware notifies after every successful write request (anything but GET / HEAD / OPTIONS that
// answered 2xx). It runs after the handler, so the change is already committed. Sitting in front of
// every route, it cannot miss a mutation added later. Admin sign-in / token refresh change nothing
// anyone watches and are skipped.
func (h *Hub) Middleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		err := c.Next()
		if err != nil {
			return err
		}
		switch c.Method() {
		case fiber.MethodGet, fiber.MethodHead, fiber.MethodOptions:
			return nil
		}
		if s := c.Response().StatusCode(); s < 200 || s > 299 {
			return nil
		}
		// Sign-in and a phone's push address change nothing anyone is looking at.
		if strings.HasPrefix(c.Path(), "/api/v1/auth/") || c.Path() == "/api/v1/worker/me/push-token" {
			return nil
		}
		h.Notify()
		return nil
	}
}

// Handler — GET /live: a server-sent event stream. ": connected" once, "data: changed" per note,
// ": ping" every heartbeat. Any signed-in admin or worker may listen (the Guard has already run).
func (h *Hub) Handler() fiber.Handler {
	return func(c *fiber.Ctx) error {
		c.Set(fiber.HeaderContentType, "text/event-stream")
		c.Set(fiber.HeaderCacheControl, "no-cache, no-transform")
		c.Set(fiber.HeaderConnection, "keep-alive")
		c.Set("X-Accel-Buffering", "no") // nginx-style proxies: don't buffer the stream
		c.Context().SetBodyStreamWriter(func(w *bufio.Writer) {
			// Subscribed before the first bytes leave, so nothing saved after the client sees
			// ": connected" can be missed.
			ch, cancel := h.Subscribe()
			defer cancel()
			tick := time.NewTicker(heartbeat)
			defer tick.Stop()
			msg := ": connected\n\n"
			for {
				if _, err := w.WriteString(msg); err != nil {
					return
				}
				if err := w.Flush(); err != nil {
					return // client went away
				}
				select {
				case <-h.done:
					return
				case <-ch:
					msg = "data: changed\n\n"
				case <-tick.C:
					msg = ": ping\n\n"
				}
			}
		})
		return nil
	}
}
