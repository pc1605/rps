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
	api.Get("/worker/me/summary", h.MySummary)

	// Admin only — manage workers
	api.Post("/workers", authSvc.RequireRole("owner", "supervisor"), h.Create)
	api.Get("/workers", authSvc.RequireRole("owner", "supervisor"), h.List)

	// Worker page (U1) — admin only
	admin := authSvc.RequireRole("owner", "supervisor")
	api.Get("/workers/:id", admin, h.Detail)
	api.Get("/workers/:id/summary", admin, h.Summary)
	api.Get("/workers/:id/history", admin, h.History)
	api.Patch("/workers/:id", admin, h.Update)
	api.Post("/workers/:id/reset-pin", admin, h.ResetPIN)
}
