package auth

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var in LoginInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}

	resp, err := h.svc.Login(c.Context(), in)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return httpx.Unauthorized(c, "invalid email or password")
		}
		if errors.Is(err, ErrUserDeactivated) {
			return httpx.Forbidden(c, "account deactivated")
		}
		return httpx.Internal(c, "login failed")
	}
	return httpx.OK(c, resp)
}

func (h *Handler) Me(c *fiber.Ctx) error {
	uid, ok := c.Locals("user_id").(uuid.UUID)
	if !ok {
		return httpx.Unauthorized(c, "missing user context")
	}
	user, err := h.svc.GetUser(c.Context(), uid)
	if err != nil {
		return httpx.Unauthorized(c, "user not found")
	}
	return httpx.OK(c, user)
}

type refreshInput struct {
	RefreshToken string `json:"refresh_token"`
}

func (h *Handler) Refresh(c *fiber.Ctx) error {
	var in refreshInput
	if err := c.BodyParser(&in); err != nil || in.RefreshToken == "" {
		return httpx.BadRequest(c, "refresh_token required")
	}
	user, tokens, err := h.svc.Refresh(c.Context(), in.RefreshToken)
	if err != nil {
		return httpx.Unauthorized(c, "invalid or expired refresh token")
	}
	return httpx.OK(c, fiber.Map{"user": user, "tokens": tokens})
}