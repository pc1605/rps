package reference

import (
	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func RegisterRoutes(api fiber.Router, svc *Service) {
	h := NewHandler(svc)
	api.Get("/car-models", h.CarModels)
	api.Get("/rolls", h.Rolls)
}

func (h *Handler) CarModels(c *fiber.Ctx) error {
	rows, err := h.svc.pool.Query(c.Context(), `
		SELECT cm.id, cb.name, cm.name, cm.size_class::text
		FROM car_models cm JOIN car_brands cb ON cb.id = cm.brand_id
		ORDER BY cb.name, cm.name
	`)
	if err != nil {
		return httpx.Internal(c, "failed to load car models")
	}
	defer rows.Close()

	type model struct {
		ID        int    `json:"id"`
		BrandName string `json:"brand_name"`
		Name      string `json:"name"`
		SizeClass string `json:"size_class"`
	}
	out := []model{}
	for rows.Next() {
		var m model
		if err := rows.Scan(&m.ID, &m.BrandName, &m.Name, &m.SizeClass); err != nil {
			return httpx.Internal(c, "scan error")
		}
		out = append(out, m)
	}
	return httpx.OK(c, out)
}

func (h *Handler) Rolls(c *fiber.Ctx) error {
	rows, err := h.svc.pool.Query(c.Context(), `
		SELECT id, roll_code, color, remaining_meters
		FROM raw_materials WHERE is_active ORDER BY roll_code
	`)
	if err != nil {
		return httpx.Internal(c, "failed to load rolls")
	}
	defer rows.Close()

	type roll struct {
		ID              string  `json:"id"`
		RollCode        string  `json:"roll_code"`
		Color           string  `json:"color"`
		RemainingMeters float64 `json:"remaining_meters"`
	}
	out := []roll{}
	for rows.Next() {
		var r roll
		if err := rows.Scan(&r.ID, &r.RollCode, &r.Color, &r.RemainingMeters); err != nil {
			return httpx.Internal(c, "scan error")
		}
		out = append(out, r)
	}
	return httpx.OK(c, out)
}