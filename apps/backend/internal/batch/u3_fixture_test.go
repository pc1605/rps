package batch

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/pc1605/rps/apps/backend/internal/testutil"
)

// u3fx is a small floor for the U3 tests (cancel, spares, release, undo): one admin, the seeded
// cutter and packer, and fresh stitchers. Everything it creates is cleaned up.
type u3fx struct {
	t        *testing.T
	ctx      context.Context
	pool     *pgxpool.Pool
	s        *Service
	admin    uuid.UUID
	cutter   uuid.UUID
	packer   uuid.UUID
	car      int
	stitcher func(name string) uuid.UUID
}

const u3ip = "127.0.0.1"

func newU3(t *testing.T, tag string) *u3fx {
	t.Helper()
	f := &u3fx{t: t, ctx: context.Background(), pool: testutil.DB(t)}
	f.s = NewService(f.pool, t.TempDir())
	one := func(q string, dst *uuid.UUID) {
		if err := f.pool.QueryRow(f.ctx, q).Scan(dst); err != nil {
			t.Fatal(err)
		}
	}
	one(`SELECT id FROM users LIMIT 1`, &f.admin)
	one(`SELECT id FROM workers WHERE station='cutter' AND is_active LIMIT 1`, &f.cutter)
	one(`SELECT id FROM workers WHERE station='packer' AND is_active LIMIT 1`, &f.packer)
	f.car = testCar(t, f.pool, tag)
	sfx := time.Now().UnixNano()
	f.stitcher = func(name string) uuid.UUID {
		t.Helper()
		var id uuid.UUID
		if err := f.pool.QueryRow(f.ctx, `
			INSERT INTO workers (name, station, badge_token, pin_hash, created_by)
			VALUES ($1, 'stitcher', $2, $3, $4) RETURNING id`,
			fmt.Sprintf("%s %s %d", tag, name, sfx), fmt.Sprintf("t-%s-%s-%d", tag, name, sfx),
			"$2a$10$"+strings.Repeat("x", 53), f.admin).Scan(&id); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { _, _ = f.pool.Exec(f.ctx, `DELETE FROM workers WHERE id = $1`, id) })
		return id
	}
	return f
}

// cleanupBatch deletes a batch (and its units/logs) at test end; registered after the workers it
// references, so it runs first. Units moved in from other batches go with it.
func (f *u3fx) cleanupBatch(id uuid.UUID) {
	f.t.Cleanup(func() {
		_, _ = f.pool.Exec(f.ctx, `DELETE FROM batches WHERE parent_batch_id = $1`, id)
		_, _ = f.pool.Exec(f.ctx, `DELETE FROM batches WHERE id = $1`, id)
	})
}

func (f *u3fx) create(in CreateInput) *Batch {
	f.t.Helper()
	if in.CarModelID == 0 {
		in.CarModelID = f.car
	}
	b, err := f.s.Create(f.ctx, in, f.admin, "owner", u3ip)
	if err != nil {
		f.t.Fatal(err)
	}
	f.cleanupBatch(b.ID)
	return b
}

func (f *u3fx) cut(id uuid.UUID, n int) {
	f.t.Helper()
	if err := f.s.StartPhase(f.ctx, id, f.cutter, "cutter", u3ip); err != nil {
		f.t.Fatal(err)
	}
	if err := f.s.CompletePhase(f.ctx, id, f.cutter, "cutter", n, "", u3ip); err != nil {
		f.t.Fatal(err)
	}
}

func (f *u3fx) assign(id uuid.UUID, entries ...AssignmentInput) {
	f.t.Helper()
	if err := f.s.SetAssignments(f.ctx, id, PhaseStitching, entries, f.admin, u3ip); err != nil {
		f.t.Fatal(err)
	}
}

func (f *u3fx) scan(code string, w uuid.UUID, station string) *ScanResult {
	f.t.Helper()
	r, err := f.s.ScanUnit(f.ctx, code, w, station, u3ip)
	if err != nil {
		f.t.Fatalf("scan %s as %s: %v", code, station, err)
	}
	return r
}

func (f *u3fx) join(id, w uuid.UUID, station string) {
	f.t.Helper()
	if err := f.s.StartPhase(f.ctx, id, w, station, u3ip); err != nil {
		f.t.Fatal(err)
	}
}

// codes returns the batch's unit codes by unit_number.
func (f *u3fx) codes(id uuid.UUID) []string {
	f.t.Helper()
	rows, err := f.pool.Query(f.ctx, `SELECT unit_code FROM batch_units WHERE batch_id=$1 ORDER BY unit_number`, id)
	if err != nil {
		f.t.Fatal(err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var c string
		if err := rows.Scan(&c); err != nil {
			f.t.Fatal(err)
		}
		out = append(out, c)
	}
	return out
}

func (f *u3fx) state(id uuid.UUID) (Phase, Status) {
	f.t.Helper()
	var p Phase
	var st Status
	if err := f.pool.QueryRow(f.ctx, `SELECT current_phase, status FROM batches WHERE id=$1`, id).Scan(&p, &st); err != nil {
		f.t.Fatal(err)
	}
	return p, st
}

func (f *u3fx) count(q string, args ...any) int {
	f.t.Helper()
	var n int
	if err := f.pool.QueryRow(f.ctx, q, args...).Scan(&n); err != nil {
		f.t.Fatal(err)
	}
	return n
}
