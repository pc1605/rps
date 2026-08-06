package report

import (
	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/auth"
)

func RegisterRoutes(api fiber.Router, svc *Service, authSvc *auth.Service) {
	h := NewHandler(svc)
	api.Get("/reports/workers", authSvc.RequireRole("owner", "supervisor"), h.Workers)
}