package worker

import (
	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/auth"
)

func RegisterRoutes(api fiber.Router, svc *Service, authSvc *auth.Service) {
	h := NewHandler(svc, authSvc)

	// Public — worker login (badge + PIN)
	api.Post("/worker/login", h.Login)

	// Worker-authenticated
	api.Get("/worker/me", h.Me)

	// Admin only — manage workers
	api.Post("/workers", authSvc.RequireRole("owner", "supervisor"), h.Create)
	api.Get("/workers", authSvc.RequireRole("owner", "supervisor"), h.List)
}