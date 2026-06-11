package httpx

import "github.com/gofiber/fiber/v2"

type ErrorBody struct {
	Error   string `json:"error"`
	Code    string `json:"code,omitempty"`
	Details any    `json:"details,omitempty"`
}

func Error(c *fiber.Ctx, status int, code, msg string) error {
	return c.Status(status).JSON(ErrorBody{
		Error: msg,
		Code:  code,
	})
}

func BadRequest(c *fiber.Ctx, msg string) error {
	return Error(c, fiber.StatusBadRequest, "bad_request", msg)
}

func Unauthorized(c *fiber.Ctx, msg string) error {
	return Error(c, fiber.StatusUnauthorized, "unauthorized", msg)
}

func Forbidden(c *fiber.Ctx, msg string) error {
	return Error(c, fiber.StatusForbidden, "forbidden", msg)
}

func Internal(c *fiber.Ctx, msg string) error {
	return Error(c, fiber.StatusInternalServerError, "internal", msg)
}

func OK(c *fiber.Ctx, data any) error {
	return c.JSON(fiber.Map{"data": data})
}