package auth

import "github.com/gofiber/fiber/v2"

// RegisterRoutes mounts all auth routes onto the /api/v1 group.
// Authentication is handled globally by Guard (mounted in main.go) —
// /auth/login is open because it's listed in PublicPaths.
func RegisterRoutes(api fiber.Router, svc *Service) {
	h := NewHandler(svc)

	api.Post("/auth/login", h.Login) // public via PublicPaths
	api.Get("/me", h.Me)             // protected automatically by Guard
}