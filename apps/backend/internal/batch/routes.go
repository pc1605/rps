package batch

import (
	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/auth"
)

func RegisterRoutes(api fiber.Router, svc *Service, authSvc *auth.Service) {
	h := NewHandler(svc)
	// Admin = owner/supervisor user token. Worker tokens (role = station) get 403.
	admin := authSvc.RequireRole("owner", "supervisor")

	// Admin reads
	api.Get("/batches/stats", admin, h.Stats)
	api.Get("/batches", admin, h.List)
	api.Get("/batches/:id", admin, h.Get)
	api.Get("/rework", admin, h.AdminListRework)

	// Admin actions
	api.Post("/batches", admin, h.Create)
	api.Post("/batches/:id/stickers-printed", admin, h.MarkStickersPrinted)
	api.Post("/batches/:id/resolve-short", admin, h.ResolveShort)
	api.Put("/batches/:id/assignments", admin, h.SetAssignments)
	api.Post("/rework/:id/decide", admin, h.AdminDecideRework)

	// Worker (phone) routes — handlers check the worker token/station
	api.Get("/worker/batches", h.WorkerBatches)
	api.Post("/worker/batches/:id/start", h.StartBatch)
	api.Post("/worker/batches/:id/complete", h.CompleteBatch)
	api.Get("/worker/units/:code/peek", h.PeekUnit)
	api.Post("/worker/units/scan", h.ScanUnit)
	api.Post("/worker/units/:code/rework", h.FlagRework)
	api.Get("/worker/rework", h.WorkerRework)

	// Signed photo URLs (public in Guard; signature verified in handler)
	api.Get("/files/rework/:name", h.ServeReworkFile)
}
