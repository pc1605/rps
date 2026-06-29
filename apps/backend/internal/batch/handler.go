package batch

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var in CreateInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}

	actorID, ok := auth.UserID(c)
	if !ok {
		return httpx.Unauthorized(c, "missing user context")
	}
	actorRole := auth.RoleFromCtx(c)

	b, err := h.svc.Create(c.Context(), in, actorID, actorRole, c.IP())
	if err != nil {
		if errors.Is(err, ErrInvalidInput) {
			return httpx.BadRequest(c, err.Error())
		}
		return httpx.Internal(c, "failed to create batch")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": b})
}

func (h *Handler) List(c *fiber.Ctx) error {
	batches, err := h.svc.List(c.Context())
	if err != nil {
		return httpx.Internal(c, "failed to list batches")
	}
	if batches == nil {
		batches = []Batch{}
	}
	return httpx.OK(c, batches)
}

func (h *Handler) Get(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid batch id")
	}
	detail, err := h.svc.Get(c.Context(), id)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "batch not found")
		}
		return httpx.Internal(c, "failed to get batch")
	}
	return httpx.OK(c, detail)
}

func (h *Handler) Stats(c *fiber.Ctx) error {
	stats, err := h.svc.GetStats(c.Context())
	if err != nil {
		return httpx.Internal(c, "failed to load stats")
	}
	return httpx.OK(c, stats)
}