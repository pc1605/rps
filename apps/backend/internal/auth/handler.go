package auth

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"

	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

// RefreshCookie holds the admin's refresh token. The browser keeps it where page scripts can't
// read it (httpOnly) and sends it only to the auth routes, only from the admin web's own site.
const (
	RefreshCookie     = "rps_refresh"
	refreshCookiePath = "/api/v1/auth"
)

type Handler struct {
	svc *Service
	// secureCookies marks the refresh cookie HTTPS-only (production). Off in development (http://localhost).
	secureCookies bool
}

func NewHandler(svc *Service, secureCookies bool) *Handler {
	return &Handler{svc: svc, secureCookies: secureCookies}
}

// setRefreshCookie hands the refresh token to the browser as a cookie and takes it out of the
// response body, so page scripts never see it.
func (h *Handler) setRefreshCookie(c *fiber.Ctx, tokens *TokenPair) {
	c.Cookie(&fiber.Cookie{
		Name:     RefreshCookie,
		Value:    tokens.RefreshToken,
		Path:     refreshCookiePath,
		MaxAge:   int(h.svc.refreshTTL.Seconds()),
		HTTPOnly: true,
		Secure:   h.secureCookies,
		SameSite: fiber.CookieSameSiteStrictMode,
	})
	tokens.RefreshToken = ""
}

func (h *Handler) clearRefreshCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     RefreshCookie,
		Value:    "",
		Path:     refreshCookiePath,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
		HTTPOnly: true,
		Secure:   h.secureCookies,
		SameSite: fiber.CookieSameSiteStrictMode,
	})
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
	h.setRefreshCookie(c, &resp.Tokens)
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

// Refresh — public. Trades the refresh cookie for a new access token (and a renewed cookie).
func (h *Handler) Refresh(c *fiber.Ctx) error {
	token := c.Cookies(RefreshCookie)
	if token == "" {
		return httpx.Unauthorized(c, "not signed in")
	}
	user, tokens, err := h.svc.Refresh(c.Context(), token)
	if err != nil {
		h.clearRefreshCookie(c)
		return httpx.Unauthorized(c, "invalid or expired refresh token")
	}
	h.setRefreshCookie(c, tokens)
	return httpx.OK(c, fiber.Map{"user": user, "tokens": tokens})
}

// Logout — public. Removes the refresh cookie; page scripts can't do that themselves.
func (h *Handler) Logout(c *fiber.Ctx) error {
	h.clearRefreshCookie(c)
	return httpx.OK(c, fiber.Map{"signed_out": true})
}
