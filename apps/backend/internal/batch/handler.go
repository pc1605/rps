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

type completeInput struct {
	QuantityCompleted int    `json:"quantity_completed"`
	Notes             string `json:"notes,omitempty"`
}

func (h *Handler) StartBatch(c *fiber.Ctx) error {
	if auth.ActorType(c) != "worker" {
		return httpx.Forbidden(c, "worker token required")
	}
	wid, _ := auth.WorkerID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid batch id")
	}
	err = h.svc.StartPhase(c.Context(), id, wid, auth.StationFromCtx(c), c.IP())
	return transitionResponse(c, err, "batch started")
}

func (h *Handler) CompleteBatch(c *fiber.Ctx) error {
	if auth.ActorType(c) != "worker" {
		return httpx.Forbidden(c, "worker token required")
	}
	wid, _ := auth.WorkerID(c)
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid batch id")
	}
	var in completeInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	err = h.svc.CompletePhase(c.Context(), id, wid, auth.StationFromCtx(c), in.QuantityCompleted, in.Notes, c.IP())
	return transitionResponse(c, err, "batch completed")
}

func transitionResponse(c *fiber.Ctx, err error, okMsg string) error {
	switch {
	case err == nil:
		return httpx.OK(c, fiber.Map{"message": okMsg})
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "batch not found")
	case errors.Is(err, ErrWrongPhase):
		return httpx.Error(c, fiber.StatusConflict, "wrong_phase", ErrWrongPhase.Error())
	case errors.Is(err, ErrAlreadyStarted):
		return httpx.Error(c, fiber.StatusConflict, "already_started", ErrAlreadyStarted.Error())
	case errors.Is(err, ErrNotStarted):
		return httpx.Error(c, fiber.StatusConflict, "not_started", ErrNotStarted.Error())
	case errors.Is(err, ErrNotYours):
		return httpx.Forbidden(c, ErrNotYours.Error())
	case errors.Is(err, ErrInvalidInput):
		return httpx.BadRequest(c, err.Error())
	default:
		return httpx.Internal(c, "transition failed")
	}
}

// WorkerBatches — batches waiting at the calling worker's station.
func (h *Handler) WorkerBatches(c *fiber.Ctx) error {
	if auth.ActorType(c) != "worker" {
		return httpx.Forbidden(c, "worker token required")
	}
	phase, ok := PhaseForStation[auth.StationFromCtx(c)]
	if !ok {
		return httpx.Forbidden(c, "unknown station")
	}
	batches, err := h.svc.ListByPhase(c.Context(), phase)
	if err != nil {
		return httpx.Internal(c, "failed to load batches")
	}
	if batches == nil {
		batches = []Batch{}
	}
	return httpx.OK(c, batches)
}
