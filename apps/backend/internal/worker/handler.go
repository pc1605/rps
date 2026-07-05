package worker

import (
	"errors"

	"github.com/gofiber/fiber/v2"
	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

type Handler struct {
	svc     *Service
	authSvc *auth.Service
}

func NewHandler(svc *Service, authSvc *auth.Service) *Handler {
	return &Handler{svc: svc, authSvc: authSvc}
}

// Create — admin only
func (h *Handler) Create(c *fiber.Ctx) error {
	var in CreateInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	actorID, _ := auth.UserID(c)
	actorRole := auth.RoleFromCtx(c)

	w, err := h.svc.Create(c.Context(), in, actorID, actorRole, c.IP())
	if err != nil {
		if errors.Is(err, ErrInvalidInput) {
			return httpx.BadRequest(c, err.Error())
		}
		return httpx.Internal(c, "failed to create worker")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": w})
}

// List — admin only
func (h *Handler) List(c *fiber.Ctx) error {
	workers, err := h.svc.List(c.Context())
	if err != nil {
		return httpx.Internal(c, "failed to list workers")
	}
	return httpx.OK(c, workers)
}

// Login — public (badge + PIN). Issues a worker JWT.
func (h *Handler) Login(c *fiber.Ctx) error {
	var in LoginInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}

	w, err := h.svc.Login(c.Context(), in.BadgeToken, in.PIN)
	if err != nil {
		if errors.Is(err, ErrInvalidLogin) {
			return httpx.Unauthorized(c, "invalid badge or pin")
		}
		return httpx.Internal(c, "login failed")
	}

	tokens, err := h.authSvc.IssueWorkerToken(w.ID, string(w.Station))
	if err != nil {
		return httpx.Internal(c, "failed to issue token")
	}

	return httpx.OK(c, fiber.Map{
		"worker": w,
		"tokens": tokens,
	})
}

// Me — worker's own profile
func (h *Handler) Me(c *fiber.Ctx) error {
	wid, ok := auth.WorkerID(c)
	if !ok {
		return httpx.Unauthorized(c, "not a worker token")
	}
	// simple: return id + station from context; full fetch optional
	station, _ := c.Locals("station").(string)
	return httpx.OK(c, fiber.Map{
		"id":      wid,
		"station": station,
	})
}