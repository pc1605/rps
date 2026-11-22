package worker

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"

	"github.com/pc1605/rps/apps/backend/internal/audit"
)

var (
	ErrInvalidInput = errors.New("invalid input")
	ErrInvalidLogin = errors.New("invalid code or pin")
	ErrNotFound     = errors.New("worker not found")
)

var pinRegex = regexp.MustCompile(`^\d{4}$`)

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

// EnrollCodeTTL is how long a fresh enrollment code can be used.
const EnrollCodeTTL = 10 * time.Minute

// maxEnrollTries: wrong PINs allowed against one enrollment code before it dies.
const maxEnrollTries = 5

// generateEnrollCode makes a random 6-digit code — short enough for the admin to type on the phone.
// It works once, for 10 minutes, together with the worker's PIN.
func generateEnrollCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func hashEnrollCode(code string) string {
	sum := sha256.Sum256([]byte(code))
	return hex.EncodeToString(sum[:])
}

// Create makes a worker with a hashed PIN. The phone is set up afterwards with a one-time
// enrollment code (NewEnrollmentCode).
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
		INSERT INTO workers (name, phone, station, pin_hash, created_by)
		VALUES ($1, NULLIF($2,''), $3, $4, $5)
		RETURNING id, name, COALESCE(phone,''), station, is_active, last_login_at, created_at
	`, in.Name, in.Phone, in.Station, string(pinHash), actorID).Scan(
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

	return &w, nil
}

// NewEnrollmentCode makes a fresh one-time code for setting up this worker's phone and returns it
// with its expiry. Any earlier code for the worker stops working. Only the hash is stored.
func (s *Service) NewEnrollmentCode(ctx context.Context, id, actorID uuid.UUID, actorRole, ip string) (string, time.Time, error) {
	// 6 digits can collide with another worker's waiting code (unique index) — draw again.
	for attempt := 0; ; attempt++ {
		code, expires, err := s.tryNewEnrollmentCode(ctx, id, actorID, actorRole, ip)
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" && attempt < 5 {
			continue
		}
		return code, expires, err
	}
}

func (s *Service) tryNewEnrollmentCode(ctx context.Context, id, actorID uuid.UUID, actorRole, ip string) (string, time.Time, error) {
	code, err := generateEnrollCode()
	if err != nil {
		return "", time.Time{}, err
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", time.Time{}, err
	}
	defer tx.Rollback(ctx)

	// Expired codes only take up numbers — clear them first.
	if _, err := tx.Exec(ctx, `
		UPDATE workers SET enroll_code_hash = NULL, enroll_expires_at = NULL, enroll_tries = 0
		WHERE enroll_expires_at <= NOW()`); err != nil {
		return "", time.Time{}, err
	}
	var expires time.Time
	err = tx.QueryRow(ctx, `
		UPDATE workers
		SET enroll_code_hash = $2, enroll_expires_at = NOW() + $3::interval, enroll_tries = 0
		WHERE id = $1 AND is_active
		RETURNING enroll_expires_at
	`, id, hashEnrollCode(code), fmt.Sprintf("%d seconds", int(EnrollCodeTTL.Seconds()))).Scan(&expires)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", time.Time{}, ErrNotFound
	}
	if err != nil {
		return "", time.Time{}, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: actorID.String(), ActorRole: actorRole, EntityType: "worker", EntityID: id.String(),
		Action: audit.ActionUpdate, After: map[string]any{"event": "enrollment_code_issued"}, IP: ip,
	}); err != nil {
		return "", time.Time{}, err
	}
	return code, expires, tx.Commit(ctx)
}

// EnrollmentStatus is what the admin's "Set up phone" dialog needs to tell whether the code it shows
// still works: the live code's expiry (nil = no live code), wrong PINs left on it, and the last sign-in.
// The dialog compares these with its own code — the code itself is never returned again.
type EnrollmentStatus struct {
	ExpiresAt   *time.Time `json:"expires_at"`
	TriesLeft   int        `json:"tries_left"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

// GetEnrollmentStatus reads the worker's current enrollment code state (see EnrollmentStatus).
func (s *Service) GetEnrollmentStatus(ctx context.Context, id uuid.UUID) (*EnrollmentStatus, error) {
	var (
		st    EnrollmentStatus
		tries int
	)
	err := s.pool.QueryRow(ctx, `
		SELECT CASE WHEN enroll_code_hash IS NOT NULL AND enroll_expires_at > NOW() THEN enroll_expires_at END,
		       enroll_tries, last_login_at
		FROM workers WHERE id = $1`, id).Scan(&st.ExpiresAt, &tries, &st.LastLoginAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if st.ExpiresAt != nil {
		st.TriesLeft = maxEnrollTries - tries
	}
	return &st, nil
}

// Login signs a phone in with a one-time enrollment code + the worker's PIN. On success the code is
// used up and the worker's session number goes up, which signs out any other phone (one phone per
// worker). Returns the worker and the new session number for the token.
func (s *Service) Login(ctx context.Context, code, pin, ip string) (*Worker, int, error) {
	if code == "" || pin == "" {
		return nil, 0, ErrInvalidLogin
	}

	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, 0, err
	}
	defer tx.Rollback(ctx)

	var (
		w       Worker
		pinHash string
		station string
		tries   int
	)
	err = tx.QueryRow(ctx, `
		SELECT id, name, COALESCE(phone,''), station, pin_hash, is_active, created_at, enroll_tries
		FROM workers
		WHERE enroll_code_hash = $1 AND enroll_expires_at > NOW() AND is_active = TRUE
		FOR UPDATE
	`, hashEnrollCode(code)).Scan(&w.ID, &w.Name, &w.Phone, &station, &pinHash, &w.IsActive, &w.CreatedAt, &tries)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, 0, ErrInvalidLogin // don't reveal whether the code exists
	}
	if err != nil {
		return nil, 0, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(pinHash), []byte(pin)); err != nil {
		// Count the wrong PIN; after too many the code is dead and the admin must make a new one.
		if _, err := tx.Exec(ctx, `
			UPDATE workers
			SET enroll_tries      = CASE WHEN enroll_tries + 1 >= $2 THEN 0 ELSE enroll_tries + 1 END,
			    enroll_code_hash  = CASE WHEN enroll_tries + 1 >= $2 THEN NULL ELSE enroll_code_hash END,
			    enroll_expires_at = CASE WHEN enroll_tries + 1 >= $2 THEN NULL ELSE enroll_expires_at END
			WHERE id = $1`, w.ID, maxEnrollTries); err != nil {
			return nil, 0, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, 0, err
		}
		return nil, 0, ErrInvalidLogin
	}

	var session int
	if err := tx.QueryRow(ctx, `
		UPDATE workers
		SET enroll_code_hash = NULL, enroll_expires_at = NULL, enroll_tries = 0,
		    session_no = session_no + 1, last_login_at = NOW(),
		    push_token = NULL, push_token_at = NULL -- the old phone is signed out: no more notifications there
		WHERE id = $1
		RETURNING session_no, last_login_at`, w.ID).Scan(&session, &w.LastLoginAt); err != nil {
		return nil, 0, err
	}
	if err := audit.Write(ctx, tx, audit.Entry{
		ActorID: w.ID.String(), ActorRole: station, EntityType: "worker", EntityID: w.ID.String(),
		Action: audit.ActionUpdate, After: map[string]any{"event": "phone_enrolled"}, IP: ip,
	}); err != nil {
		return nil, 0, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, 0, err
	}

	w.Station = Station(station)
	return &w, session, nil
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

// GetByID returns a worker's profile.
func (s *Service) GetByID(ctx context.Context, id uuid.UUID) (*Worker, error) {
	var w Worker
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, COALESCE(phone,''), station, is_active, last_login_at, created_at
		FROM workers WHERE id = $1
	`, id).Scan(&w.ID, &w.Name, &w.Phone, &w.Station, &w.IsActive, &w.LastLoginAt, &w.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &w, nil
}

// maxPushToken bounds what a phone may store (FCM tokens are about 160 characters).
const maxPushToken = 4096

// SetPushToken saves the signed-in phone's notification address and language (N1).
func (s *Service) SetPushToken(ctx context.Context, workerID uuid.UUID, token, lang string) error {
	token = strings.TrimSpace(token)
	if token == "" || len(token) > maxPushToken {
		return fmt.Errorf("%w: token required", ErrInvalidInput)
	}
	if lang != "en" && lang != "hi" {
		return fmt.Errorf("%w: lang must be en or hi", ErrInvalidInput)
	}
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `UPDATE workers SET push_token = $2, push_lang = $3, push_token_at = NOW() WHERE id = $1`,
		workerID, token, lang)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	// One address, one worker: a phone whose last sign-out never reached the server (offline) still
	// holds that worker's address — the worker now signed in on it takes it over.
	if _, err := tx.Exec(ctx, `UPDATE workers SET push_token = NULL, push_token_at = NULL
		WHERE push_token = $2 AND id <> $1`, workerID, token); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// ClearPushToken: the phone is signing out — stop notifying it.
func (s *Service) ClearPushToken(ctx context.Context, workerID uuid.UUID) error {
	_, err := s.pool.Exec(ctx, `UPDATE workers SET push_token = NULL, push_token_at = NULL WHERE id = $1`, workerID)
	return err
}
