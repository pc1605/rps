package batch

import (
	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/auth"
)

func RegisterRoutes(api fiber.Router, svc *Service, authSvc *auth.Service) {
	h := NewHandler(svc)

	// Any authenticated admin can view
	api.Get("/batches/stats", h.Stats)
	api.Get("/batches", h.List)
	api.Get("/batches/:id", h.Get)
	api.Get("/worker/batches", h.WorkerBatches)

	// Only owner + supervisor can create (Week 2 decision)
	api.Post("/batches", authSvc.RequireRole("owner", "supervisor"), h.Create)
	api.Post("/worker/batches/:id/start", h.StartBatch)
	api.Post("/worker/batches/:id/complete", h.CompleteBatch)
}