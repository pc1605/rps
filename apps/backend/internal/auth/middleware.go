package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

// PublicPaths are the only exact-match routes reachable without a token.
// Everything else under /api/v1 requires auth. Every entry here is a
// security decision — add consciously.
var PublicPaths = map[string]bool{
	"POST /api/v1/auth/login":   true, // admin login
	"POST /api/v1/worker/login": true, // worker badge + PIN login
	// "POST /api/v1/auth/refresh": true,  ← when refresh flow added
}

// Guard is the global default-deny auth middleware.
// Mounted ONCE on the /api/v1 group in main.go. Every request under
// /api/v1 passes through it; public paths are waved through, everything
// else must present a valid Bearer access token.
func (s *Service) Guard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if strings.HasPrefix(c.Path(), "/api/v1/public/") {
			return c.Next()
		}
		key := c.Method() + " " + c.Path()
		if PublicPaths[key] {
			return c.Next()
		}

		header := c.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return httpx.Unauthorized(c, "missing bearer token")
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		// Try admin token first
		if claims, err := s.ParseAccessToken(tokenStr); err == nil {
			c.Locals("user_id", claims.UserID)
			c.Locals("role", claims.Role)
			c.Locals("actor_type", "user")
			return c.Next()
		}

		// Then worker token
		if wc, err := s.ParseWorkerToken(tokenStr); err == nil {
			c.Locals("worker_id", wc.WorkerID)
			c.Locals("station", wc.Station)
			c.Locals("role", wc.Station) // station acts as role for workers
			c.Locals("actor_type", "worker")
			return c.Next()
		}

		return httpx.Unauthorized(c, "invalid or expired token")
	}
}

// WorkerID extracts the authenticated worker's ID from context.
func WorkerID(c *fiber.Ctx) (uuid.UUID, bool) {
	wid, ok := c.Locals("worker_id").(uuid.UUID)
	return wid, ok
}

// ActorType returns "user" or "worker".
func ActorType(c *fiber.Ctx) string {
	t, _ := c.Locals("actor_type").(string)
	return t
}

// RequireRole checks the authenticated user has one of the allowed roles.
// Use per-route, AFTER Guard has run (Guard sets the role in context).
//
//	api.Post("/batches", authSvc.RequireRole("owner", "supervisor"), h.Create)
func (s *Service) RequireRole(roles ...string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		role, _ := c.Locals("role").(string)
		for _, r := range roles {
			if r == role {
				return c.Next()
			}
		}
		return httpx.Forbidden(c, "insufficient role")
	}
}

// UserID extracts the authenticated user's ID from the request context.
// Returns false if no authenticated user (shouldn't happen behind Guard).
func UserID(c *fiber.Ctx) (uuid.UUID, bool) {
	uid, ok := c.Locals("user_id").(uuid.UUID)
	return uid, ok
}

// RoleFromCtx extracts the authenticated user's role from the request context.
func RoleFromCtx(c *fiber.Ctx) string {
	role, _ := c.Locals("role").(string)
	return role
}

// StationFromCtx extracts the worker's station from the request context.
func StationFromCtx(c *fiber.Ctx) string {
	s, _ := c.Locals("station").(string)
	return s
}