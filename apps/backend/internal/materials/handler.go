package materials

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/factorytime"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func actor(c *fiber.Ctx) Actor {
	uid, _ := auth.UserID(c)
	return Actor{UserID: uid, Role: auth.RoleFromCtx(c), IP: c.IP()}
}

func body(c *fiber.Ctx, dst any) error {
	if err := c.BodyParser(dst); err != nil {
		return invalid("invalid request body: %v", err)
	}
	return nil
}

func intParam(c *fiber.Ctx, name string) (int, error) {
	v, err := c.ParamsInt(name)
	if err != nil || v <= 0 {
		return 0, invalid("invalid %s", name)
	}
	return v, nil
}

func uuidParam(c *fiber.Ctx, name string) (uuid.UUID, error) {
	v, err := uuid.Parse(c.Params(name))
	if err != nil {
		return uuid.Nil, invalid("invalid %s", name)
	}
	return v, nil
}

func optIntQuery(c *fiber.Ctx, name string) (*int, error) {
	s := c.Query(name)
	if s == "" {
		return nil, nil
	}
	v, err := strconv.Atoi(s)
	if err != nil || v <= 0 {
		return nil, invalid("invalid %s", name)
	}
	return &v, nil
}

func optUUIDQuery(c *fiber.Ctx, name string) (*uuid.UUID, error) {
	s := c.Query(name)
	if s == "" {
		return nil, nil
	}
	v, err := uuid.Parse(s)
	if err != nil {
		return nil, invalid("invalid %s", name)
	}
	return &v, nil
}

func optBoolQuery(c *fiber.Ctx, name string) (*bool, error) {
	s := c.Query(name)
	if s == "" {
		return nil, nil
	}
	v, err := strconv.ParseBool(s)
	if err != nil {
		return nil, invalid("%s must be true or false", name)
	}
	return &v, nil
}

// ───── types ─────

func (h *Handler) ListTypes(c *fiber.Ctx) error {
	out, err := h.svc.ListTypes(c.Context())
	if err != nil {
		return fail(c, err, "list material types")
	}
	return httpx.OK(c, out)
}

func (h *Handler) CreateType(c *fiber.Ctx) error {
	var in TypeInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "create material type")
	}
	out, err := h.svc.CreateType(c.Context(), in, actor(c))
	if err != nil {
		return fail(c, err, "create material type")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": out})
}

func (h *Handler) UpdateType(c *fiber.Ctx) error {
	id, err := intParam(c, "id")
	if err != nil {
		return fail(c, err, "update material type")
	}
	var in TypeInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "update material type")
	}
	out, err := h.svc.UpdateType(c.Context(), id, in, actor(c))
	if err != nil {
		return fail(c, err, "update material type")
	}
	return httpx.OK(c, out)
}

// ───── variants ─────

func (h *Handler) ListVariants(c *fiber.Ctx) error {
	id, err := intParam(c, "id")
	if err != nil {
		return fail(c, err, "list variants")
	}
	out, err := h.svc.ListVariants(c.Context(), id)
	if err != nil {
		return fail(c, err, "list variants")
	}
	return httpx.OK(c, out)
}

func (h *Handler) CreateVariant(c *fiber.Ctx) error {
	id, err := intParam(c, "id")
	if err != nil {
		return fail(c, err, "create variant")
	}
	var in VariantInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "create variant")
	}
	out, err := h.svc.CreateVariant(c.Context(), id, in, actor(c))
	if err != nil {
		return fail(c, err, "create variant")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": out})
}

func (h *Handler) UpdateVariant(c *fiber.Ctx) error {
	id, err := intParam(c, "id")
	if err != nil {
		return fail(c, err, "update variant")
	}
	var in VariantInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "update variant")
	}
	out, err := h.svc.UpdateVariant(c.Context(), id, in, actor(c))
	if err != nil {
		return fail(c, err, "update variant")
	}
	return httpx.OK(c, out)
}

// ───── lots ─────

func (h *Handler) ListLots(c *fiber.Ctx) error {
	typeID, err := optIntQuery(c, "type_id")
	if err != nil {
		return fail(c, err, "list lots")
	}
	active, err := optBoolQuery(c, "active")
	if err != nil {
		return fail(c, err, "list lots")
	}
	low, err := optBoolQuery(c, "low")
	if err != nil {
		return fail(c, err, "list lots")
	}
	out, err := h.svc.ListLots(c.Context(), typeID, active, low != nil && *low)
	if err != nil {
		return fail(c, err, "list lots")
	}
	return httpx.OK(c, out)
}

func (h *Handler) Receive(c *fiber.Ctx) error {
	var in ReceiveInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "receive lot")
	}
	out, err := h.svc.Receive(c.Context(), in, actor(c))
	if err != nil {
		return fail(c, err, "receive lot")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": out})
}

func (h *Handler) lotAction(c *fiber.Ctx, what string, run func(uuid.UUID) (*Lot, error)) error {
	id, err := uuidParam(c, "id")
	if err != nil {
		return fail(c, err, what)
	}
	out, err := run(id)
	if err != nil {
		return fail(c, err, what)
	}
	return httpx.OK(c, out)
}

func (h *Handler) Adjust(c *fiber.Ctx) error {
	var in AdjustInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "adjust lot")
	}
	return h.lotAction(c, "adjust lot", func(id uuid.UUID) (*Lot, error) { return h.svc.Adjust(c.Context(), id, in, actor(c)) })
}

func (h *Handler) Waste(c *fiber.Ctx) error {
	var in QtyReasonInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "record waste")
	}
	return h.lotAction(c, "record waste", func(id uuid.UUID) (*Lot, error) { return h.svc.Waste(c.Context(), id, in, actor(c)) })
}

func (h *Handler) Return(c *fiber.Ctx) error {
	var in QtyReasonInput
	if err := body(c, &in); err != nil {
		return fail(c, err, "record return")
	}
	return h.lotAction(c, "record return", func(id uuid.UUID) (*Lot, error) { return h.svc.Return(c.Context(), id, in, actor(c)) })
}

func (h *Handler) PatchLot(c *fiber.Ctx) error {
	var in LotPatch
	if err := body(c, &in); err != nil {
		return fail(c, err, "update lot")
	}
	return h.lotAction(c, "update lot", func(id uuid.UUID) (*Lot, error) { return h.svc.PatchLot(c.Context(), id, in, actor(c)) })
}

// ───── movements ─────

func (h *Handler) ListMovements(c *fiber.Ctx) error {
	var f MovementFilter
	var err error
	if f.LotID, err = optUUIDQuery(c, "lot_id"); err != nil {
		return fail(c, err, "list movements")
	}
	if f.TypeID, err = optIntQuery(c, "type_id"); err != nil {
		return fail(c, err, "list movements")
	}
	if f.BatchID, err = optUUIDQuery(c, "batch_id"); err != nil {
		return fail(c, err, "list movements")
	}
	if v := c.Query("from"); v != "" { // factory days, inclusive
		t, err := factorytime.ParseDay(v)
		if err != nil {
			return fail(c, invalid("from must be YYYY-MM-DD"), "list movements")
		}
		f.From = &t
	}
	if v := c.Query("to"); v != "" {
		t, err := factorytime.ParseDay(v)
		if err != nil {
			return fail(c, invalid("to must be YYYY-MM-DD"), "list movements")
		}
		t = t.AddDate(0, 0, 1)
		f.To = &t
	}
	if v := c.Query("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n <= 0 {
			return fail(c, invalid("limit must be a positive number"), "list movements")
		}
		f.Limit = n
	}
	f.Cursor = c.Query("cursor")
	out, err := h.svc.ListMovements(c.Context(), f)
	if err != nil {
		return fail(c, err, "list movements")
	}
	return httpx.OK(c, out)
}
