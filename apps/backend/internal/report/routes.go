package report

import (
	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/auth"
)

func RegisterRoutes(api fiber.Router, svc *Service, authSvc *auth.Service) {
	h := NewHandler(svc)
	admin := authSvc.RequireRole("owner", "supervisor")
	api.Get("/reports/workers", admin, h.Workers)
	api.Get("/reports/worker-output", admin, h.WorkerOutput)
	api.Get("/reports/overview", admin, h.Overview)
	api.Get("/reports/stuck", admin, h.Stuck)
	api.Get("/reports/quality", admin, h.Quality)
	api.Get("/settings", admin, h.Settings)
	api.Put("/settings/stuck_hours", admin, h.PutStuckHours)
}
