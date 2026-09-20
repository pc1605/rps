package reference

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/rs/zerolog/log"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Service struct{ pool *pgxpool.Pool }

func NewService(pool *pgxpool.Pool) *Service { return &Service{pool: pool} }

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func RegisterRoutes(api fiber.Router, svc *Service) {
	h := NewHandler(svc)
	api.Get("/car-models", h.CarModels)
	api.Post("/car-models", h.CreateCarModel)
	api.Patch("/car-models/:id", h.UpdateCarModel)
	api.Get("/car-brands", h.Brands)
	api.Post("/car-brands", h.CreateBrand)
	api.Get("/product-lines", h.ProductLines)
	api.Get("/rolls", h.Rolls)
}

func (h *Handler) CarModels(c *fiber.Ctx) error {
	rows, err := h.svc.pool.Query(c.Context(), `
		SELECT cm.id, cb.name, cm.name, cm.size_class::text, cm.pieces_per_set,
		       pln.code, pln.name, cm.barcode, cm.is_active                     -- ① column added
		FROM car_models cm
		JOIN car_brands cb ON cb.id = cm.brand_id
		LEFT JOIN product_lines pln ON pln.id = cm.product_line_id
		ORDER BY cb.name, cm.name, cm.size_class, pln.code
	`)
	if err != nil {
		log.Error().Err(err).Msg("list car models")
		return httpx.Internal(c, "failed to load car models")
	}
	defer rows.Close()

	type model struct {
		ID           int     `json:"id"`
		BrandName    string  `json:"brand_name"`
		Name         string  `json:"name"`
		SizeClass    string  `json:"size_class"`
		PiecesPerSet int     `json:"pieces_per_set"`
		LineCode     *string `json:"line_code,omitempty"`
		LineName     *string `json:"line_name,omitempty"`
		Barcode      *string `json:"barcode,omitempty"`
		IsActive     bool    `json:"is_active"`
	}
	out := []model{}
	for rows.Next() {
		var m model
		if err := rows.Scan(&m.ID, &m.BrandName, &m.Name, &m.SizeClass, &m.PiecesPerSet,
			&m.LineCode, &m.LineName, &m.Barcode, &m.IsActive); err != nil {
			log.Error().Err(err).Msg("scan car model")
			return httpx.Internal(c, "scan error")
		}
		out = append(out, m)
	}
	return httpx.OK(c, out)
}

// SetBarcode — PATCH /car-models/:id/barcode {"barcode": "8901234567890"}.
// Empty string clears it. Barcodes are unique across models.
func (h *Handler) SetBarcode(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return httpx.BadRequest(c, "invalid car model id")
	}
	var in struct {
		Barcode string `json:"barcode"`
	}
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}

	barcode := strings.TrimSpace(in.Barcode)
	var arg *string
	if barcode != "" {
		arg = &barcode
	}

	ct, err := h.svc.pool.Exec(c.Context(), `UPDATE car_models SET barcode = $1 WHERE id = $2`, arg, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return httpx.Error(c, fiber.StatusConflict, "duplicate_barcode", "that barcode is already used by another car model")
		}
		log.Error().Err(err).Msg("set car model barcode")
		return httpx.Internal(c, "failed to set barcode")
	}
	if ct.RowsAffected() == 0 {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "car model not found")
	}
	return httpx.OK(c, fiber.Map{"message": "barcode updated"})
}

func (h *Handler) Rolls(c *fiber.Ctx) error {
	rows, err := h.svc.pool.Query(c.Context(), `
		SELECT id, roll_code, color, remaining_meters
		FROM raw_materials WHERE is_active ORDER BY roll_code
	`)
	if err != nil {
		log.Error().Err(err).Msg("list rolls")
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

func (h *Handler) Brands(c *fiber.Ctx) error {
	rows, err := h.svc.pool.Query(c.Context(), `SELECT id, name FROM car_brands ORDER BY name`)
	if err != nil {
		return httpx.Internal(c, "failed to load brands")
	}
	defer rows.Close()
	type brand struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	}
	out := []brand{}
	for rows.Next() {
		var b brand
		if err := rows.Scan(&b.ID, &b.Name); err != nil {
			return httpx.Internal(c, "scan error")
		}
		out = append(out, b)
	}
	return httpx.OK(c, out)
}

func (h *Handler) CreateBrand(c *fiber.Ctx) error {
	var in struct {
		Name string `json:"name"`
	}
	if err := c.BodyParser(&in); err != nil || strings.TrimSpace(in.Name) == "" {
		return httpx.BadRequest(c, "name required")
	}
	var id int
	err := h.svc.pool.QueryRow(c.Context(), `
		INSERT INTO car_brands (name) VALUES ($1)
		ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id
	`, strings.TrimSpace(in.Name)).Scan(&id)
	if err != nil {
		log.Error().Err(err).Msg("create brand")
		return httpx.Internal(c, "failed to create brand")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": fiber.Map{"id": id, "name": strings.TrimSpace(in.Name)}})
}

func (h *Handler) ProductLines(c *fiber.Ctx) error {
	rows, err := h.svc.pool.Query(c.Context(), `SELECT id, code, name FROM product_lines WHERE is_active ORDER BY id`)
	if err != nil {
		return httpx.Internal(c, "failed to load product lines")
	}
	defer rows.Close()
	type line struct {
		ID   int    `json:"id"`
		Code string `json:"code"`
		Name string `json:"name"`
	}
	out := []line{}
	for rows.Next() {
		var l line
		if err := rows.Scan(&l.ID, &l.Code, &l.Name); err != nil {
			return httpx.Internal(c, "scan error")
		}
		out = append(out, l)
	}
	return httpx.OK(c, out)
}

// luhn returns the check digit for a numeric string.
func luhn(digits string) int {
	sum, alt := 0, true
	for i := len(digits) - 1; i >= 0; i-- {
		d := int(digits[i] - '0')
		if alt {
			d *= 2
			if d > 9 {
				d -= 9
			}
		}
		sum += d
		alt = !alt
	}
	return (10 - sum%10) % 10
}

type carModelInput struct {
	BrandID       *int    `json:"brand_id"`
	Name          *string `json:"name"`
	SizeClass     *string `json:"size_class"`
	PiecesPerSet  *int    `json:"pieces_per_set"`
	ProductLineID *int    `json:"product_line_id"`
	Barcode       *string `json:"barcode"` // empty/omitted on create → generated
	IsActive      *bool   `json:"is_active"`
}

func (h *Handler) CreateCarModel(c *fiber.Ctx) error {
	var in carModelInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	if in.BrandID == nil || in.Name == nil || strings.TrimSpace(*in.Name) == "" || in.SizeClass == nil || in.ProductLineID == nil {
		return httpx.BadRequest(c, "brand_id, name, size_class and product_line_id are required")
	}
	pieces := 4
	if in.PiecesPerSet != nil && *in.PiecesPerSet > 0 {
		pieces = *in.PiecesPerSet
	}
	barcode := ""
	if in.Barcode != nil {
		barcode = strings.TrimSpace(*in.Barcode)
	}
	ctx := c.Context()
	if barcode == "" {
		var seq int64
		if err := h.svc.pool.QueryRow(ctx, `SELECT nextval('car_barcode_seq')`).Scan(&seq); err != nil {
			return httpx.Internal(c, "failed to generate barcode")
		}
		body := fmt.Sprintf("386%08d", seq)
		barcode = fmt.Sprintf("%s%d", body, luhn(body))
	}
	var id int
	err := h.svc.pool.QueryRow(ctx, `
		INSERT INTO car_models (brand_id, name, size_class, pieces_per_set, product_line_id, barcode)
		VALUES ($1, $2, $3::text::car_size, $4, $5, $6) RETURNING id
	`, *in.BrandID, strings.TrimSpace(*in.Name), *in.SizeClass, pieces, *in.ProductLineID, barcode).Scan(&id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			if strings.Contains(pgErr.ConstraintName, "barcode") {
				return httpx.Error(c, fiber.StatusConflict, "duplicate_barcode", "that barcode already exists")
			}
			return httpx.Error(c, fiber.StatusConflict, "duplicate_item", "this car · size · line already exists")
		}
		log.Error().Err(err).Msg("create car model")
		return httpx.Internal(c, "failed to create item")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": fiber.Map{"id": id, "barcode": barcode}})
}

func (h *Handler) UpdateCarModel(c *fiber.Ctx) error {
	id, err := c.ParamsInt("id")
	if err != nil {
		return httpx.BadRequest(c, "invalid id")
	}
	var in carModelInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	var bc *string
	if in.Barcode != nil {
		t := strings.TrimSpace(*in.Barcode)
		if t != "" {
			bc = &t
		}
	}
	var name *string
	if in.Name != nil {
		t := strings.TrimSpace(*in.Name)
		name = &t
	}
	ct, err := h.svc.pool.Exec(c.Context(), `
		UPDATE car_models SET
		  brand_id        = COALESCE($1, brand_id),
		  name            = COALESCE($2, name),
		  size_class      = COALESCE($3::text::car_size, size_class),
		  pieces_per_set  = COALESCE($4, pieces_per_set),
		  product_line_id = COALESCE($5, product_line_id),
		  barcode         = COALESCE($6, barcode),
		  is_active       = COALESCE($7, is_active)
		WHERE id = $8
	`, in.BrandID, name, in.SizeClass, in.PiecesPerSet, in.ProductLineID, bc, in.IsActive, id)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return httpx.Error(c, fiber.StatusConflict, "duplicate", "barcode or car·size·line already exists")
		}
		log.Error().Err(err).Msg("update car model")
		return httpx.Internal(c, "failed to update item")
	}
	if ct.RowsAffected() == 0 {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "item not found")
	}
	return httpx.OK(c, fiber.Map{"message": "item updated"})
}
