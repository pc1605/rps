package worker

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/factorytime"
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

// Me — worker's own full profile (used by the app on cold start).
func (h *Handler) Me(c *fiber.Ctx) error {
	wid, ok := auth.WorkerID(c)
	if !ok {
		return httpx.Unauthorized(c, "not a worker token")
	}
	w, err := h.svc.GetByID(c.Context(), wid)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "worker not found")
		}
		return httpx.Internal(c, "failed to load profile")
	}
	return httpx.OK(c, w)
}

// ───── worker page (U1) ─────

func workerErr(c *fiber.Ctx, err error, what string) error {
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "worker not found")
	case errors.Is(err, ErrInvalidInput):
		return httpx.BadRequest(c, strings.TrimPrefix(err.Error(), ErrInvalidInput.Error()+": "))
	case errors.Is(err, ErrWorkerBusy):
		return httpx.Error(c, fiber.StatusConflict, "worker_busy", strings.TrimPrefix(err.Error(), ErrWorkerBusy.Error()+": "))
	}
	log.Error().Err(err).Str("op", what).Msg("worker")
	return httpx.Internal(c, "failed to "+what)
}

func workerID(c *fiber.Ctx) (uuid.UUID, error) {
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return uuid.Nil, fmt.Errorf("%w: invalid worker id", ErrInvalidInput)
	}
	return id, nil
}

func (h *Handler) Detail(c *fiber.Ctx) error {
	id, err := workerID(c)
	if err != nil {
		return workerErr(c, err, "load worker")
	}
	out, err := h.svc.Detail(c.Context(), id)
	if err != nil {
		return workerErr(c, err, "load worker")
	}
	return httpx.OK(c, out)
}

// Summary — GET /workers/:id/summary?from=YYYY-MM-DD&to=YYYY-MM-DD (factory days, inclusive; default last 14).
func (h *Handler) Summary(c *fiber.Ctx) error {
	id, err := workerID(c)
	if err != nil {
		return workerErr(c, err, "load worker summary")
	}
	today := factorytime.StartOfDay(time.Now())
	from, to := today.AddDate(0, 0, -13), today.AddDate(0, 0, 1)
	if v := c.Query("from"); v != "" {
		if from, err = factorytime.ParseDay(v); err != nil {
			return httpx.BadRequest(c, "from must be YYYY-MM-DD")
		}
	}
	if v := c.Query("to"); v != "" {
		t, err := factorytime.ParseDay(v)
		if err != nil {
			return httpx.BadRequest(c, "to must be YYYY-MM-DD")
		}
		to = t.AddDate(0, 0, 1)
	}
	if !to.After(from) {
		return httpx.BadRequest(c, "'to' must not be before 'from'")
	}
	out, err := h.svc.Summary(c.Context(), id, from, to)
	if err != nil {
		return workerErr(c, err, "load worker summary")
	}
	return httpx.OK(c, out)
}

func (h *Handler) History(c *fiber.Ctx) error {
	id, err := workerID(c)
	if err != nil {
		return workerErr(c, err, "load worker history")
	}
	out, err := h.svc.History(c.Context(), id, c.QueryInt("limit", 25), c.Query("cursor"))
	if err != nil {
		return workerErr(c, err, "load worker history")
	}
	return httpx.OK(c, out)
}

func (h *Handler) Update(c *fiber.Ctx) error {
	id, err := workerID(c)
	if err != nil {
		return workerErr(c, err, "update worker")
	}
	var in UpdateInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	actorID, _ := auth.UserID(c)
	out, err := h.svc.Update(c.Context(), id, in, actorID, auth.RoleFromCtx(c), c.IP())
	if err != nil {
		return workerErr(c, err, "update worker")
	}
	return httpx.OK(c, out)
}

// ResetPIN — POST /workers/:id/reset-pin {pin?}. Returns the new PIN once (random if not given).
func (h *Handler) ResetPIN(c *fiber.Ctx) error {
	id, err := workerID(c)
	if err != nil {
		return workerErr(c, err, "reset pin")
	}
	var in struct {
		PIN string `json:"pin"`
	}
	if len(c.Body()) > 0 {
		if err := c.BodyParser(&in); err != nil {
			return httpx.BadRequest(c, "invalid request body")
		}
	}
	actorID, _ := auth.UserID(c)
	pin, err := h.svc.ResetPIN(c.Context(), id, in.PIN, actorID, auth.RoleFromCtx(c), c.IP())
	if err != nil {
		return workerErr(c, err, "reset pin")
	}
	return httpx.OK(c, fiber.Map{"pin": pin})
}
