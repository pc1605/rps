package stock

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Handler struct{ svc *Service }

func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

func (h *Handler) List(c *fiber.Ctx) error {
	rolls, err := h.svc.List(c.Context())
	if err != nil {
		return httpx.Internal(c, "failed to list rolls")
	}
	return httpx.OK(c, rolls)
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var in CreateRollInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	actorID, ok := auth.UserID(c)
	if !ok {
		return httpx.Unauthorized(c, "missing user context")
	}
	r, err := h.svc.Create(c.Context(), in, actorID, auth.RoleFromCtx(c), c.IP())
	if err != nil {
		switch {
		case errors.Is(err, ErrDuplicateCode):
			return httpx.Error(c, fiber.StatusConflict, "duplicate_code", err.Error())
		case errors.Is(err, ErrInvalidInput):
			return httpx.BadRequest(c, err.Error())
		default:
			return httpx.Internal(c, "failed to create roll")
		}
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": r})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid roll id")
	}
	var in UpdateRollInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	actorID, ok := auth.UserID(c)
	if !ok {
		return httpx.Unauthorized(c, "missing user context")
	}
	r, err := h.svc.Update(c.Context(), id, in, actorID, auth.RoleFromCtx(c), c.IP())
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "roll not found")
		case errors.Is(err, ErrInvalidInput):
			return httpx.BadRequest(c, err.Error())
		default:
			return httpx.Internal(c, "failed to update roll")
		}
	}
	return httpx.OK(c, r)
}