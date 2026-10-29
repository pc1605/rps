package batch

import (
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
	"github.com/rs/zerolog/log"
)

var reworkFileRegex = regexp.MustCompile(`^[0-9a-f-]{36}\.(jpg|png)$`)

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
		log.Error().Err(err).Msg("create batch")
		return httpx.Internal(c, "failed to create batch")
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": b})
}

func (h *Handler) List(c *fiber.Ctx) error {
	batches, err := h.svc.List(c.Context())
	if err != nil {
		log.Error().Err(err).Msg("list batches")
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
	case errors.Is(err, ErrNotAssigned):
		return httpx.Error(c, fiber.StatusForbidden, "not_assigned", ErrNotAssigned.Error())
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
	wid, _ := auth.WorkerID(c)
	phase, ok := PhaseForStation[auth.StationFromCtx(c)]
	if !ok {
		return httpx.Forbidden(c, "unknown station")
	}
	batches, err := h.svc.ListByPhase(c.Context(), phase, wid)
	if err != nil {
		return httpx.Internal(c, "failed to load batches")
	}
	if batches == nil {
		batches = []Batch{}
	}
	return httpx.OK(c, batches)
}

type scanInput struct {
	UnitCode string `json:"unit_code"`
}

func (h *Handler) ScanUnit(c *fiber.Ctx) error {
	if auth.ActorType(c) != "worker" {
		return httpx.Forbidden(c, "worker token required")
	}
	var in scanInput
	if err := c.BodyParser(&in); err != nil || strings.TrimSpace(in.UnitCode) == "" {
		return httpx.BadRequest(c, "unit_code required")
	}
	wid, _ := auth.WorkerID(c)

	res, err := h.svc.ScanUnit(c.Context(), strings.TrimSpace(in.UnitCode), wid, auth.StationFromCtx(c), c.IP())
	if err != nil {
		switch {
		case errors.Is(err, ErrInRework):
			return httpx.Error(c, fiber.StatusConflict, "in_rework", "This mat is waiting for rework")
		case errors.Is(err, ErrReworkPendingDecision):
			return httpx.Error(c, fiber.StatusConflict, "rework_pending_decision", "Rework is awaiting admin decision")
		case errors.Is(err, ErrNotYourRework):
			return httpx.Error(c, fiber.StatusForbidden, "not_your_rework", "This rework is assigned to another stitcher")
		case errors.Is(err, ErrReworkNotOpen):
			return httpx.Error(c, fiber.StatusConflict, "rework_not_open", "Rework round is not open")
		case errors.Is(err, ErrUnitNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "unit_not_found", "unknown QR — not an RPS unit label")
		case errors.Is(err, ErrWrongPhase):
			return httpx.Error(c, fiber.StatusConflict, "wrong_phase", "this batch is not at your station's phase")
		case errors.Is(err, ErrQuotaReached):
			return httpx.Error(c, fiber.StatusConflict, "quota_reached", err.Error())
		case errors.Is(err, ErrNotStarted):
			return httpx.Error(c, fiber.StatusConflict, "not_started", "join this batch before scanning")
		case errors.Is(err, ErrNotYours):
			return httpx.Forbidden(c, ErrNotYours.Error())
		default:
			log.Error().Err(err).Msg("scan unit")
			return httpx.Internal(c, "scan failed")
		}
	}
	return httpx.OK(c, res)
}

type assignInput struct {
	Phase       Phase `json:"phase"`
	Assignments []struct {
		WorkerID  string `json:"worker_id"`
		TargetQty *int   `json:"target_qty,omitempty"`
	} `json:"assignments"`
}

func (h *Handler) SetAssignments(c *fiber.Ctx) error {
	if auth.ActorType(c) != "user" {
		return httpx.Forbidden(c, "admin token required")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid batch id")
	}
	var in assignInput
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	if in.Phase != PhaseCutting && in.Phase != PhaseStitching && in.Phase != PhasePacking {
		return httpx.BadRequest(c, "phase must be cutting, stitching or packing")
	}
	entries := make([]AssignmentInput, 0, len(in.Assignments))
	for _, a := range in.Assignments {
		wid, err := uuid.Parse(a.WorkerID)
		if err != nil {
			return httpx.BadRequest(c, "invalid worker id")
		}
		if a.TargetQty != nil && *a.TargetQty <= 0 {
			return httpx.BadRequest(c, "target_qty must be positive")
		}
		entries = append(entries, AssignmentInput{WorkerID: wid, TargetQty: a.TargetQty})
	}
	adminID, _ := auth.UserID(c)
	if err := h.svc.SetAssignments(c.Context(), id, in.Phase, entries, adminID, c.IP()); err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "batch not found")
		case errors.Is(err, ErrInvalidInput):
			return httpx.BadRequest(c, err.Error())
		default:
			return httpx.Internal(c, "failed to set assignments")
		}
	}
	return httpx.OK(c, fiber.Map{"message": "assignments updated"})
}

func (h *Handler) MarkStickersPrinted(c *fiber.Ctx) error {
	if auth.ActorType(c) != "user" {
		return httpx.Forbidden(c, "admin token required")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid batch id")
	}
	if err := h.svc.MarkStickersPrinted(c.Context(), id); err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "batch not found")
		}
		return httpx.Internal(c, "failed to mark stickers printed")
	}
	return httpx.OK(c, fiber.Map{"message": "stickers marked printed"})
}

func (h *Handler) ResolveShort(c *fiber.Ctx) error {
	if auth.ActorType(c) != "user" {
		return httpx.Forbidden(c, "admin token required")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid batch id")
	}
	var in struct {
		Action string `json:"action"`
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}
	adminID, _ := auth.UserID(c)
	remainder, err := h.svc.ResolveShort(c.Context(), id, ShortAction(in.Action), strings.TrimSpace(in.Reason), adminID, c.IP())
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "batch not found")
		case errors.Is(err, ErrInvalidInput):
			return httpx.BadRequest(c, err.Error())
		default:
			log.Error().Err(err).Msg("resolve short cut")
			return httpx.Internal(c, "failed to resolve short cut")
		}
	}
	return httpx.OK(c, fiber.Map{"message": "resolved", "remainder_batch_code": remainder})
}

func (h *Handler) FlagRework(c *fiber.Ctx) error {
	if auth.ActorType(c) != "worker" {
		return httpx.Forbidden(c, "worker token required")
	}
	if auth.StationFromCtx(c) != "packer" {
		return httpx.Forbidden(c, "packer station required")
	}
	wid, _ := auth.WorkerID(c)
	unitCode := strings.TrimSpace(c.Params("code"))
	if unitCode == "" {
		return httpx.BadRequest(c, "unit code required")
	}

	form, err := c.MultipartForm()
	if err != nil {
		return httpx.BadRequest(c, "invalid multipart form")
	}

	var rawReasons []string
	if vals, ok := form.Value["reasons"]; ok {
		for _, val := range vals {
			for _, part := range strings.Split(val, ",") {
				p := strings.TrimSpace(part)
				if p != "" {
					rawReasons = append(rawReasons, p)
				}
			}
		}
	}
	if len(rawReasons) == 0 {
		return httpx.BadRequest(c, "at least one rework reason required")
	}

	var notePtr *string
	if notes, ok := form.Value["note"]; ok && len(notes) > 0 {
		n := strings.TrimSpace(notes[0])
		if n != "" {
			notePtr = &n
		}
	}

	files := form.File["photos"]
	if len(files) < 1 || len(files) > 3 {
		return httpx.BadRequest(c, "1 to 3 photos required")
	}

	uploadDir := h.svc.UploadDir()
	reworkDir := filepath.Join(uploadDir, "rework")
	if err := os.MkdirAll(reworkDir, 0750); err != nil {
		log.Error().Err(err).Msg("ensure rework upload dir")
		return httpx.Internal(c, "failed to prepare upload storage")
	}

	var savedFiles []string
	cleanSaved := func() {
		for _, sf := range savedFiles {
			_ = os.Remove(sf)
		}
	}

	for _, file := range files {
		if file.Size > 5*1024*1024 {
			cleanSaved()
			return httpx.BadRequest(c, "each photo must be 5MB or less")
		}
		src, err := file.Open()
		if err != nil {
			cleanSaved()
			return httpx.BadRequest(c, "unable to read photo")
		}
		buf := make([]byte, 512)
		n, err := src.Read(buf)
		_ = src.Close()
		if err != nil && !errors.Is(err, io.EOF) {
			cleanSaved()
			return httpx.BadRequest(c, "unable to inspect photo content")
		}
		contentType := http.DetectContentType(buf[:n])
		var ext string
		switch contentType {
		case "image/jpeg":
			ext = ".jpg"
		case "image/png":
			ext = ".png"
		default:
			cleanSaved()
			return httpx.BadRequest(c, "photos must be jpeg or png")
		}

		filename := uuid.New().String() + ext
		destPath := filepath.Join(reworkDir, filename)
		if err := c.SaveFile(file, destPath); err != nil {
			cleanSaved()
			log.Error().Err(err).Msg("save rework photo")
			return httpx.Internal(c, "failed to save photo")
		}
		savedFiles = append(savedFiles, destPath)
	}

	entry, err := h.svc.FlagRework(c.Context(), unitCode, wid, "packer", rawReasons, notePtr, savedFiles, c.IP())
	if err != nil {
		cleanSaved()
		switch {
		case errors.Is(err, ErrUnitNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "unit_not_found", "unit not found")
		case errors.Is(err, ErrWrongPhase):
			return httpx.Error(c, fiber.StatusConflict, "wrong_phase", err.Error())
		case errors.Is(err, ErrNotStarted):
			return httpx.Error(c, fiber.StatusConflict, "not_started", "join this batch before flagging rework")
		case errors.Is(err, ErrInvalidInput):
			return httpx.BadRequest(c, err.Error())
		default:
			log.Error().Err(err).Msg("flag rework")
			return httpx.Internal(c, "failed to flag rework")
		}
	}

	return httpx.OK(c, entry)
}

func (h *Handler) WorkerRework(c *fiber.Ctx) error {
	if auth.ActorType(c) != "worker" {
		return httpx.Forbidden(c, "worker token required")
	}
	if auth.StationFromCtx(c) != "stitcher" {
		return httpx.Forbidden(c, "stitcher station required")
	}
	wid, _ := auth.WorkerID(c)

	items, err := h.svc.ListReworkForStitcher(c.Context(), wid)
	if err != nil {
		log.Error().Err(err).Msg("list rework for stitcher")
		return httpx.Internal(c, "failed to list rework")
	}
	if items == nil {
		items = []ReworkEntry{}
	}
	return httpx.OK(c, items)
}

func (h *Handler) AdminListRework(c *fiber.Ctx) error {
	if auth.ActorType(c) != "user" {
		return httpx.Forbidden(c, "admin token required")
	}
	status := c.Query("status", "open")
	var routePtr *string
	if r := strings.TrimSpace(c.Query("route")); r != "" {
		routePtr = &r
	}

	items, err := h.svc.ListRework(c.Context(), status, routePtr)
	if err != nil {
		if errors.Is(err, ErrInvalidInput) {
			return httpx.BadRequest(c, err.Error())
		}
		log.Error().Err(err).Msg("list rework")
		return httpx.Internal(c, "failed to list rework")
	}
	if items == nil {
		items = []ReworkEntry{}
	}
	return httpx.OK(c, items)
}

func (h *Handler) AdminDecideRework(c *fiber.Ctx) error {
	if auth.ActorType(c) != "user" {
		return httpx.Forbidden(c, "admin token required")
	}
	adminID, ok := auth.UserID(c)
	if !ok {
		return httpx.Unauthorized(c, "missing user context")
	}
	id, err := uuid.Parse(c.Params("id"))
	if err != nil {
		return httpx.BadRequest(c, "invalid rework id")
	}
	var in struct {
		Decision string  `json:"decision"`
		Note     *string `json:"note,omitempty"`
	}
	if err := c.BodyParser(&in); err != nil {
		return httpx.BadRequest(c, "invalid request body")
	}

	entry, err := h.svc.DecideRework(c.Context(), id, strings.TrimSpace(in.Decision), in.Note, adminID, c.IP())
	if err != nil {
		switch {
		case errors.Is(err, ErrNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "rework entry not found")
		case errors.Is(err, ErrReworkNotOpen):
			return httpx.Error(c, fiber.StatusConflict, "rework_not_open", ErrReworkNotOpen.Error())
		case errors.Is(err, ErrInvalidInput):
			return httpx.BadRequest(c, err.Error())
		default:
			log.Error().Err(err).Msg("decide rework")
			return httpx.Internal(c, "failed to decide rework")
		}
	}
	return httpx.OK(c, entry)
}

func (h *Handler) ServeReworkFile(c *fiber.Ctx) error {
	name := c.Params("name")
	if !reworkFileRegex.MatchString(name) {
		return httpx.BadRequest(c, "invalid file name")
	}

	filePath := filepath.Join(h.svc.UploadDir(), "rework", name)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "file not found")
	}

	c.Set("Cache-Control", "private, max-age=86400")
	return c.SendFile(filePath)
}
