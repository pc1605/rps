package stock

import (
	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/auth"
)

func RegisterRoutes(api fiber.Router, svc *Service, authSvc *auth.Service) {
	h := NewHandler(svc)

	// Admin-only stock management
	api.Get("/stock/rolls", authSvc.RequireRole("owner", "supervisor"), h.List)
	api.Get("/stock/finished", authSvc.RequireRole("owner", "supervisor"), h.Finished)
	api.Post("/stock/rolls", authSvc.RequireRole("owner", "supervisor"), h.Create)
	api.Patch("/stock/rolls/:id", authSvc.RequireRole("owner", "supervisor"), h.Update)
}