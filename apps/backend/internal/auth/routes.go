package auth

import "github.com/gofiber/fiber/v2"

// RegisterRoutes mounts all auth routes onto the /api/v1 group.
// Authentication is handled globally by Guard (mounted in main.go) —
// the /auth/* routes are open because they're listed in PublicPaths.
// secureCookies: send the refresh cookie over HTTPS only (true in production).
func RegisterRoutes(api fiber.Router, svc *Service, secureCookies bool) {
	h := NewHandler(svc, secureCookies)

	api.Get("/me", h.Me)             // protected automatically by Guard
	api.Post("/auth/login", h.Login) // public via PublicPaths
	api.Post("/auth/refresh", h.Refresh)
	api.Post("/auth/logout", h.Logout)
}
