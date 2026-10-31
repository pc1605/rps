package materials

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

// Sentinels; validation errors wrap ErrInvalid: fmt.Errorf("%w: qty must be > 0", ErrInvalid).
var (
	ErrInvalid           = errors.New("invalid input")
	ErrNotFound          = errors.New("not found")
	ErrDuplicate         = errors.New("already exists")
	ErrUnitLocked        = errors.New("unit can't change once the type has movements")
	ErrHasActiveVariants = errors.New("type still has active variants")
	ErrVariantsInUse     = errors.New("variants of this type are used by lots, recipes or overrides")
	ErrLotHasConsumption = errors.New("lot already has consumption, waste or returns — its type/variant can't change")
	ErrGroupInUse        = errors.New("cars still use this consumption group")
	ErrGroupIsDefault    = errors.New("group is the default for a size class — move the default first")
	ErrCutterOnly        = errors.New("cutter token required")
)

var statusOf = []struct {
	err    error
	status int
	code   string
}{
	{ErrInvalid, fiber.StatusBadRequest, "bad_request"},
	{ErrNotFound, fiber.StatusNotFound, "not_found"},
	{ErrDuplicate, fiber.StatusConflict, "duplicate"},
	{ErrUnitLocked, fiber.StatusConflict, "unit_locked"},
	{ErrHasActiveVariants, fiber.StatusConflict, "has_active_variants"},
	{ErrVariantsInUse, fiber.StatusConflict, "variants_in_use"},
	{ErrLotHasConsumption, fiber.StatusConflict, "lot_has_consumption"},
	{ErrGroupInUse, fiber.StatusConflict, "group_in_use"},
	{ErrGroupIsDefault, fiber.StatusConflict, "group_is_default"},
	{ErrCutterOnly, fiber.StatusForbidden, "cutter_only"},
}

// fail maps a service error to an HTTP error; unknown errors are logged and become 500.
func fail(c *fiber.Ctx, err error, what string) error {
	for _, s := range statusOf {
		if errors.Is(err, s.err) {
			msg := strings.TrimPrefix(err.Error(), ErrInvalid.Error()+": ")
			return httpx.Error(c, s.status, s.code, msg)
		}
	}
	log.Error().Err(err).Str("op", what).Msg("materials")
	return httpx.Internal(c, "failed to "+what)
}
