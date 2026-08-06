package report

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// Workers — GET /reports/workers?from=2026-07-01&to=2026-07-31
// Defaults to the last 7 days when params are absent/invalid.
func (h *Handler) Workers(c *fiber.Ctx) error {
	now := time.Now()
	from := now.AddDate(0, 0, -7)
	to := now.Add(24 * time.Hour)

	if v := c.Query("from"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			from = t
		}
	}
	if v := c.Query("to"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			to = t.Add(24 * time.Hour) // inclusive end date
		}
	}
	if !to.After(from) {
		return httpx.BadRequest(c, "'to' must be after 'from'")
	}

	stats, err := h.svc.WorkerProductivity(c.Context(), from, to)
	if err != nil {
		return httpx.Internal(c, "failed to build report")
	}
	return httpx.OK(c, fiber.Map{
		"from":    from.Format("2006-01-02"),
		"to":      to.AddDate(0, 0, -1).Format("2006-01-02"),
		"workers": stats,
	})
}