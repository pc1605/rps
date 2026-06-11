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
	"POST /api/v1/auth/login": true,
	// "POST /api/v1/auth/worker-login": true,  ← week 3
	// "POST /api/v1/auth/refresh":      true,  ← when refresh flow added
}

// Guard is the global default-deny auth middleware.
// Mounted ONCE on the /api/v1 group in main.go. Every request under
// /api/v1 passes through it; public paths are waved through, everything
// else must present a valid Bearer access token.
func (s *Service) Guard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Public prefix — customer-facing endpoints, no auth ever.
		// (Used from week 6 for the Riddhi QR landing data endpoint.)
		if strings.HasPrefix(c.Path(), "/api/v1/public/") {
			return c.Next()
		}

		// Exact-match public endpoints (login etc.)
		key := c.Method() + " " + c.Path()
		if PublicPaths[key] {
			return c.Next()
		}

		// Everything else: validate token
		header := c.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			return httpx.Unauthorized(c, "missing bearer token")
		}

		claims, err := s.ParseAccessToken(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			return httpx.Unauthorized(c, "invalid or expired token")
		}

		c.Locals("user_id", claims.UserID)
		c.Locals("role", claims.Role)
		return c.Next()
	}
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