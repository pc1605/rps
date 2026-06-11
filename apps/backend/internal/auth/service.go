package auth

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrUserDeactivated    = errors.New("user deactivated")
)

type Service struct {
	pool             *pgxpool.Pool
	accessSecret     string
	refreshSecret    string
	accessTTL        time.Duration
	refreshTTL       time.Duration
}

func NewService(pool *pgxpool.Pool, accessSecret, refreshSecret string, accessTTL, refreshTTL time.Duration) *Service {
	return &Service{
		pool:          pool,
		accessSecret:  accessSecret,
		refreshSecret: refreshSecret,
		accessTTL:     accessTTL,
		refreshTTL:    refreshTTL,
	}
}

func (s *Service) Login(ctx context.Context, in LoginInput) (*LoginResponse, error) {
	email := strings.ToLower(strings.TrimSpace(in.Email))
	if email == "" || in.Password == "" {
		return nil, ErrInvalidCredentials
	}

	var (
		id              uuid.UUID
		name            string
		storedEmail     string
		passwordHash    string
		role            string
		deactivatedAt   *time.Time
		lastLoginAt     *time.Time
		createdAt       time.Time
	)

	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email::text, password_hash, role::text,
		       deactivated_at, last_login_at, created_at
		FROM users
		WHERE email = $1::citext
	`, email).Scan(&id, &name, &storedEmail, &passwordHash, &role, &deactivatedAt, &lastLoginAt, &createdAt)

	if err == pgx.ErrNoRows {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, fmt.Errorf("query user: %w", err)
	}
	if deactivatedAt != nil {
		return nil, ErrUserDeactivated
	}

	if err := bcrypt.CompareHashAndPassword([]byte(passwordHash), []byte(in.Password)); err != nil {
		return nil, ErrInvalidCredentials
	}

	// Update last_login_at (fire and forget — don't block login)
	go func() {
		bgCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = s.pool.Exec(bgCtx, `UPDATE users SET last_login_at = NOW() WHERE id = $1`, id)
	}()

	tokens, err := s.issueTokens(id, role)
	if err != nil {
		return nil, fmt.Errorf("issue tokens: %w", err)
	}

	return &LoginResponse{
		User: User{
			ID:            id,
			Name:          name,
			Email:         storedEmail,
			Role:          Role(role),
			DeactivatedAt: deactivatedAt,
			LastLoginAt:   lastLoginAt,
			CreatedAt:     createdAt,
		},
		Tokens: *tokens,
	}, nil
}

func (s *Service) GetUser(ctx context.Context, id uuid.UUID) (*User, error) {
	var (
		u             User
		emailStr      string
		roleStr       string
	)
	err := s.pool.QueryRow(ctx, `
		SELECT id, name, email::text, role::text, deactivated_at, last_login_at, created_at
		FROM users WHERE id = $1
	`, id).Scan(&u.ID, &u.Name, &emailStr, &roleStr, &u.DeactivatedAt, &u.LastLoginAt, &u.CreatedAt)

	if err == pgx.ErrNoRows {
		return nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, err
	}
	u.Email = emailStr
	u.Role = Role(roleStr)
	return &u, nil
}

type Claims struct {
	UserID uuid.UUID `json:"uid"`
	Role   string    `json:"role"`
	jwt.RegisteredClaims
}

func (s *Service) issueTokens(userID uuid.UUID, role string) (*TokenPair, error) {
	now := time.Now()

	accessClaims := Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    "rps",
			Subject:   userID.String(),
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.accessTTL)),
		},
	}
	accessToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims).SignedString([]byte(s.accessSecret))
	if err != nil {
		return nil, err
	}

	refreshClaims := jwt.RegisteredClaims{
		Issuer:    "rps",
		Subject:   userID.String(),
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(s.refreshTTL)),
	}
	refreshToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims).SignedString([]byte(s.refreshSecret))
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    int(s.accessTTL.Seconds()),
	}, nil
}

func (s *Service) ParseAccessToken(tokenStr string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenStr, claims, func(t *jwt.Token) (any, error) {
		if t.Method != jwt.SigningMethodHS256 {
			return nil, errors.New("unexpected signing method")
		}
		return []byte(s.accessSecret), nil
	})
	if err != nil || !token.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}