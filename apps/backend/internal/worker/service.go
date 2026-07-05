package worker

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"regexp"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

var (
	ErrInvalidInput = errors.New("invalid input")
	ErrInvalidLogin = errors.New("invalid badge or pin")
	ErrNotFound     = errors.New("worker not found")
)

var pinRegex = regexp.MustCompile(`^\d{4}$`)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// generateBadgeToken makes a random, unguessable token for the QR badge.
func generateBadgeToken() (string, error) {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	// URL-safe, no padding — clean for QR encoding
	return "BADGE-" + base64.RawURLEncoding.EncodeToString(b), nil
}

// Create makes a worker with a generated badge token + hashed PIN.
// Returns the badge_token ONCE so the admin can print the badge.
func (s *Service) Create(ctx context.Context, in CreateInput, actorID uuid.UUID, actorRole, ip string) (*Worker, error) {
	if in.Name == "" || in.Station == "" {
		return nil, fmt.Errorf("%w: name and station required", ErrInvalidInput)
	}
	if !pinRegex.MatchString(in.PIN) {
		return nil, fmt.Errorf("%w: pin must be 4 digits", ErrInvalidInput)
	}
	switch Station(in.Station) {
	case StationCutter, StationStitcher, StationPacker:
	default:
		return nil, fmt.Errorf("%w: invalid station", ErrInvalidInput)
	}

	badgeToken, err := generateBadgeToken()
	if err != nil {
		return nil, err
	}
	pinHash, err := bcrypt.GenerateFromPassword([]byte(in.PIN), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var w Worker
	err = tx.QueryRow(ctx, `
		INSERT INTO workers (name, phone, station, badge_token, pin_hash, created_by)
		VALUES ($1, NULLIF($2,''), $3, $4, $5, $6)
		RETURNING id, name, COALESCE(phone,''), station, is_active, last_login_at, created_at
	`, in.Name, in.Phone, in.Station, badgeToken, string(pinHash), actorID).Scan(
		&w.ID, &w.Name, &w.Phone, &w.Station, &w.IsActive, &w.LastLoginAt, &w.CreatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("insert worker: %w", err)
	}

	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID:    actorID.String(),
		ActorRole:  actorRole,
		EntityType: "worker",
		EntityID:   w.ID.String(),
		Action:     audit.ActionCreate,
		After:      map[string]any{"name": w.Name, "station": w.Station},
		IP:         ip,
	}); err != nil {
		return nil, fmt.Errorf("audit: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	w.BadgeToken = badgeToken // returned ONCE for badge printing
	return &w, nil
}

// Login verifies badge_token + PIN (two-factor).
func (s *Service) Login(ctx context.Context, badgeToken, pin string) (*Worker, error) {
	if badgeToken == "" || pin == "" {
		return nil, ErrInvalidLogin
	}

	var (
		w        Worker
		pinHash  string
		station  string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(phone,''), station, pin_hash, is_active, created_at
		FROM workers
		WHERE badge_token = $1 AND is_active = TRUE
	`, badgeToken).Scan(&w.ID, &w.Name, &w.Phone, &station, &pinHash, &w.IsActive, &w.CreatedAt)

	if err == pgx.ErrNoRows {
		return nil, ErrInvalidLogin // don't reveal whether badge exists
	}
	if err != nil {
		return nil, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(pinHash), []byte(pin)); err != nil {
		return nil, ErrInvalidLogin
	}

	w.Station = Station(station)

	// update last_login_at (fire and forget)
	go func() {
		bg, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = s.pool.Exec(bg, `UPDATE workers SET last_login_at = NOW() WHERE id = $1`, w.ID)
	}()

	return &w, nil
}

// List returns all workers (for admin management).
func (s *Service) List(ctx context.Context) ([]Worker, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, name, COALESCE(phone,''), station, is_active, last_login_at, created_at
		FROM workers ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Worker{}
	for rows.Next() {
		var w Worker
		if err := rows.Scan(&w.ID, &w.Name, &w.Phone, &w.Station, &w.IsActive, &w.LastLoginAt, &w.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}