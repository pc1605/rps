package report

import (
	"errors"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/factorytime"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

// parseRange reads ?from&to (factory days, inclusive) into [from, to) instants.
// Missing → the last `days` days including today. At most 366 days.
func parseRange(c *fiber.Ctx, days int) (time.Time, time.Time, error) {
	today := factorytime.StartOfDay(time.Now())
	from, to := today.AddDate(0, 0, -(days-1)), today.AddDate(0, 0, 1)
	if v := c.Query("from"); v != "" {
		t, err := factorytime.ParseDay(v)
		if err != nil {
			return from, to, errors.New("'from' must be YYYY-MM-DD")
		}
		from = t
	}
	if v := c.Query("to"); v != "" {
		t, err := factorytime.ParseDay(v)
		if err != nil {
			return from, to, errors.New("'to' must be YYYY-MM-DD")
		}
		to = t.AddDate(0, 0, 1)
	}
	if !to.After(from) {
		return from, to, errors.New("'to' must be on or after 'from'")
	}
	if to.Sub(from) > 366*24*time.Hour+time.Hour {
		return from, to, errors.New("range is limited to 366 days")
	}
	return from, to, nil
}

func internal(c *fiber.Ctx, err error, what string) error {
	log.Error().Err(err).Str("op", what).Msg("reports")
	return httpx.Internal(c, "failed to "+what)
}

func (h *Handler) Overview(c *fiber.Ctx) error {
	from, to, err := parseRange(c, 30)
	if err != nil {
		return httpx.BadRequest(c, err.Error())
	}
	out, err := h.svc.Overview(c.Context(), from, to)
	if err != nil {
		return internal(c, err, "build overview")
	}
	return httpx.OK(c, out)
}

func (h *Handler) Stuck(c *fiber.Ctx) error {
	out, err := h.svc.Stuck(c.Context())
	if err != nil {
		return internal(c, err, "list stuck batches")
	}
	return httpx.OK(c, out)
}

func (h *Handler) WorkerOutput(c *fiber.Ctx) error {
	from, to, err := parseRange(c, 7)
	if err != nil {
		return httpx.BadRequest(c, err.Error())
	}
	out, err := h.svc.WorkerOutput(c.Context(), from, to)
	if err != nil {
		return internal(c, err, "build worker output")
	}
	return httpx.OK(c, fiber.Map{"range": rangeOf(from, to), "workers": out})
}

func (h *Handler) Quality(c *fiber.Ctx) error {
	from, to, err := parseRange(c, 30)
	if err != nil {
		return httpx.BadRequest(c, err.Error())
	}
	out, err := h.svc.Quality(c.Context(), from, to)
	if err != nil {
		return internal(c, err, "build quality report")
	}
	return httpx.OK(c, out)
}

func (h *Handler) Settings(c *fiber.Ctx) error {
	out, err := h.svc.Settings(c.Context())
	if err != nil {
		return internal(c, err, "read settings")
	}
	return httpx.OK(c, out)
}

func (h *Handler) PutStuckHours(c *fiber.Ctx) error {
	var in StuckHours
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	uid, _ := auth.UserID(c)
	out, err := h.svc.PutStuckHours(c.Context(), in, uid, auth.RoleFromCtx(c), c.IP())
	if errors.Is(err, ErrInvalid) {
		return httpx.BadRequest(c, strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": "))
	}
	if err != nil {
		return internal(c, err, "save stuck thresholds")
	}
	return httpx.OK(c, out)
}
