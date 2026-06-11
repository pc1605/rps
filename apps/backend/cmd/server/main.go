package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/rs/zerolog/log"

	"github.com/pc1605/rps/apps/backend/internal/auth"
	"github.com/pc1605/rps/apps/backend/internal/config"
	"github.com/pc1605/rps/apps/backend/internal/db"
	"github.com/pc1605/rps/apps/backend/internal/httpx"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("config load failed")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// ───── Infrastructure ─────
	pool, err := db.Connect(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatal().Err(err).Msg("db connect failed")
	}
	defer pool.Close()
	log.Info().Msg("✓ database connected")

	// ───── Services (dependency wiring) ─────
	authSvc := auth.NewService(pool, cfg.JWTAccessSecret, cfg.JWTRefreshSecret, cfg.JWTAccessTTL, cfg.JWTRefreshTTL)
	// batchSvc := batch.NewService(pool)   ← week 2
	// stockSvc := stock.NewService(pool)   ← week 5

	// ───── HTTP app ─────
	app := newApp(cfg)

	// ───── Routes ─────
	api := app.Group("/api/v1")
	api.Use(authSvc.Guard()) // default-deny: everything under /api/v1 requires auth
	                         // unless listed in auth.PublicPaths or under /public/

	auth.RegisterRoutes(api, authSvc)
	// batch.RegisterRoutes(api, batchSvc, authSvc)   ← week 2
	// stock.RegisterRoutes(api, stockSvc, authSvc)   ← week 5

	// ───── Lifecycle ─────
	runServer(app, cfg)
}

// newApp builds the Fiber app with all global middleware.
func newApp(cfg *config.Config) *fiber.App {
	app := fiber.New(fiber.Config{
		AppName:               "RPS Backend v0.1",
		DisableStartupMessage: true,
		ErrorHandler: func(c *fiber.Ctx, err error) error {
			log.Error().Err(err).Str("path", c.Path()).Msg("request error")
			return httpx.Internal(c, "something went wrong")
		},
	})

	app.Use(recover.New())
	app.Use(logger.New(logger.Config{
		Format: "${time} ${status} ${method} ${path} ${latency}\n",
	}))
	app.Use(cors.New(cors.Config{
		AllowOrigins: joinOrigins(cfg.CORSOrigins),
		AllowHeaders: "Origin, Content-Type, Accept, Authorization",
		AllowMethods: "GET, POST, PATCH, DELETE, OPTIONS",
	}))

	// Health check — outside /api/v1 on purpose, so Railway can probe
	// without a token.
	app.Get("/healthz", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok"})
	})

	return app
}

// runServer starts the server and handles graceful shutdown.
func runServer(app *fiber.App, cfg *config.Config) {
	go func() {
		log.Info().Str("port", cfg.Port).Str("env", cfg.Env).Msg("✓ RPS backend listening")
		if err := app.Listen(":" + cfg.Port); err != nil {
			log.Fatal().Err(err).Msg("server failed")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Info().Msg("shutting down...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := app.ShutdownWithContext(shutdownCtx); err != nil {
		log.Error().Err(err).Msg("shutdown error")
	}
	log.Info().Msg("✓ stopped cleanly")
}

func joinOrigins(origins []string) string {
	if len(origins) == 0 {
		return "*"
	}
	out := ""
	for i, o := range origins {
		if i > 0 {
			out += ", "
		}
		out += o
	}
	return out
}