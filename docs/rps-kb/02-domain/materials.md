# Materials, recipes & consumption (Slice C)

Agreed with the owner (Oct 2026). Schema: migration **015** (`000015_materials`). C1a = schema + types; C1b = recipe
resolution + consumption engine; C1c = endpoints; C2 = admin screens; C3 = cutter "you'll need…", roll QR, lot labels;
R2 = planned vs actual, waste, cost per mat.

## The model

```
material_types ──< material_variants          (specs that change consumption, e.g. roll width)
      │                    │
      └──────< material_lots >┘                (one roll/box/pack: colour, qty, cost)  ← was raw_materials
                     │
               material_movements             (append-only ledger; qty_remaining = SUM(qty))

product_lines × consumption_groups ──< recipes ──< recipe_lines (type, variant?, qty_per_mat)
car_models ──> consumption_group     car_models ──< car_material_overrides (type, variant?, qty_per_mat ≥ 0)
batches ──< batch_material_plan (snapshot per cutting completion)
```

| Concept | Meaning | Example |
|---|---|---|
| **Material type** | A kind of input with one unit. `has_variants` says whether lots carry a variant. `min_level` = low-stock threshold for the type (sum of active lots). | Rexine R (m), Rexine 87 (m), PVC 1.8 mm (m), PVC 2.1 mm (m), Piping, Velcro, Thread |
| **Variant** | A **spec that changes how much is consumed** — *not* colour. `specs` jsonb. | 54″ / 60″ / 72″ roll width `{"width_in": 60}` |
| **Lot** | One received quantity of a type (+ variant when the type has them). **Colour lives here.** | Roll `R-014`, Rexine R, 60″, Jet Black, 50 m, ₹180/m |
| **Movement** | Ledger row: `receive` (+), `consume` (−), `adjust` (±), `waste` (−), `return` (+). | −12.4 m from R-014 for B-2026-041 |
| **Consumption group** | Explicit grouping of cars by how much they use. Seeded Small/Medium/Large; admin can add/rename ("XL 7-seater"). | Ertiga → Large |
| **Recipe** | Quantities per mat for one **product line × consumption group**. Lines per material type, optionally per variant. | Rexine R × Small: Rexine R 1.60 m (any width), 1.79 m on 54″, 1.41 m on 72″; piping 3.0 m … |
| **Car override** | Per-car exception for one type (optionally one variant). `0` = "this car doesn't use it". | Ertiga Rexine R on 60″ = 2.90 m; Kwid uses no piping |

Rexine R, Rexine 87, PVC 1.8 and PVC 2.1 are **separate material types** (same codes as the product lines). Units:
**metres** for the sheet materials (owner decision; enum `material_unit` also has `sqm`, `pcs`, `spool`, `kg`).

## Quantity resolution (C1b)

For each material type needed by a batch, given the **variant V of the lot actually used**:

1. car override for (type, V)
2. car override for (type, any)
3. recipe line for (type, V)
4. recipe line for (type, any)
5. none → plan row with `source = 'none'` (no quantity) and a note on the batch

The first match wins; an override of `0` means the type isn't used (no consumption). Recipe = the one for the car's
`product_line_id × consumption_group_id`. Types needed = union of the recipe's line types and the car's override types.

**Which lot / variant:**
- The batch's chosen roll (`batches.roll_id`, a lot) covers **that lot's type**; V = that lot's variant.
- Every other type is drawn **FIFO** (oldest `received_at` first) across active lots of the type — any variant, unless
  the matching line pins one. Resolve the quantity with the **variant of the first lot drawn**.

As built (C1b, `internal/batch/consume.go`):
- **Eligible lot** = active, `qty_remaining > 0`, and a quantity resolves for its variant. "Pinned" therefore means: if a
  type only has variant-specific lines/overrides (no "any"), only lots of those variants are drawn; with an "any" line,
  every lot of the type is eligible.
- **Roll-covered type:** order = the roll (if active with stock), then the type's other eligible lots FIFO, then a
  shortfall. V stays the roll's variant even if the roll is empty.
- **FIFO type with no eligible lot:** V = the first lot's variant if any lot exists (→ usually `none`), else none → the
  "any" quantity becomes a full shortfall.
- **No recipe lines, no overrides and no roll** for the car: no plan rows (a plan row needs a type), only the batch note
  "Materials not recorded: no recipe for this car's product line × consumption group".
- Quantities are `Milli` (int64 thousandths, exact for numeric(12,3)); never float64.

## Consumption (C1b)

- When: at **cutting-complete**, for `quantity_completed` mats — per completion, so a re-cut consumes only for the extra
  pieces. Same transaction as the phase change.
- Writes: `consume` movements (negative) per lot drawn, lot `qty_remaining` decremented, and one
  `batch_material_plan` row per type (`source`, `qty_per_mat`, `mats`, `planned_qty`, `phase_log_id`).
  Movements and plan rows carry the cutting completion's `phase_log_id`; `uq_plan_completion_type`
  (phase_log_id, type) makes a second run for the same completion fail → no double deduction.
- **Never blocks the cutter.** If the lots run out, the rest is ONE `consume` movement with `lot_id = NULL`
  (a **shortfall**, reason `shortfall`) plus the batch note "Material shortfall: <type> <qty> <unit>". Shortfall is the
  only movement allowed without a lot (DB check). Only real DB errors fail the completion.
- **Locking:** every candidate lot of every needed type is locked in ONE `… ORDER BY id FOR UPDATE`, so concurrent cuts
  lock in the same order (no deadlock); types are then processed in id order.
- **Alerts:** `/batches/stats` → `material_shortfalls_open` (shortfall movements in the last 30 days) and
  `low_stock_types` (active types with `min_level` whose active lots sum below it). Shown in the admin UI from C2.
- Actual metres measured at cutting (owner Q5) will later arrive as `adjust`/`waste` against the plan (R2).

## Known behaviour

- **Quantity per mat comes from the FIRST lot's variant.** If a batch spills from a 60″ roll onto a 54″ lot (roll ran
  out, FIFO continues), the spill is charged at the **60″ rate**. Revisit (per-lot resolution) if the owner needs it.

## API (C1c)

`internal/materials` — full list in `03-backend/api-reference.md` → Materials. Highlights:
- Receive / adjust / waste / return / PATCH lots; every quantity change goes through `materials.InsertMovement`
  (movement + `qty_remaining` in one tx). Type/variant of a lot can change only before any consume/waste/return.
- Recipes edited per product line × group (`PUT …/lines`, full replace), car overrides per car.
- The planner `materials.BuildPlan` is shared: the engine calls it with `ForUpdate` inside the cutting tx; the dry run
  `GET /recipes/resolve` and the cutter's `GET /worker/batches/:id/materials-needed` call it read-only — so the
  preview equals what a cut would draw (test `TestDryRunMatchesEngine`).
- `GET /batches/:id/materials`: plan + movements per cutting completion.

## Invariants (enforced or checked)

| Rule | Where |
|---|---|
| `lot.qty_remaining = SUM(movements.qty)` for the lot | every write path; `scripts/check-data.sql` #13 |
| Variant belongs to the row's material type (lots, recipe lines, overrides, movements, plan) | composite FK `(variant_id, material_type_id) → material_variants(id, material_type_id)`; check-data #14–15 |
| No variant on a type with `has_variants = false` | check-data #14–15 |
| Movement type = its lot's type | check-data #16 (variant may differ: it records what was known when written) |
| Sign by kind: receive/return > 0, consume/waste < 0, adjust ≠ 0 | CHECK `material_movements_sign` |
| Every active car has a recipe for its line × group | check-data #17 — **warning only** (may be non-empty until recipes are entered; consumption then plans `none`). All other check-data sections must be empty. |
| Every car has a consumption group | `NOT NULL` + trigger: a new car without one gets the group whose `default_for_size` = its `size_class` (rename-safe) |

## Compatibility until C2

- `raw_materials` was **renamed** to `material_lots` (ids kept; `roll_code→lot_code`, `total_meters→qty_received`,
  `remaining_meters→qty_remaining`, numeric(12,3)). Existing rolls became sheet lots; type inferred from the product
  line most used by their batches (default Rexine R); opening balance = `receive` + `adjust` movements.
- `batches.roll_id` keeps its name until C2 (FK now points at `material_lots`).
- `/stock/rolls`, `/rolls` keep their JSON (`roll_code`, `total_meters`, `remaining_meters`, per-roll `is_low` < 10 m).
  Creating a roll writes a `receive` movement (type defaults to Rexine R; optional `material_type_id`); a manual
  remaining correction writes an `adjust` movement for the difference.

## Seeds

`seeds/01-catalog.sql` §7–12 adds Piping/Velcro/Thread types, 54″/60″/72″ variants, 12 recipes (4 lines × 3 groups),
two example overrides, and widths on the demo rolls. **All quantities are placeholders** (recipe `note` says so) —
replace with the owner's numbers before real consumption.

## Migration notes

- `015 down` refuses (RAISE) once 015-era data exists — consumption/waste/return movements, lot variants, non-sheet
  lots — because the old `raw_materials` can't hold it. golang-migrate then marks the DB dirty at 14: nothing was
  changed (single transaction); recover with `migrate … force 15`.
- New enums: `material_unit`, `movement_kind`.

## Open owner questions

- Real recipe numbers per line × group × width; units for piping / velcro / thread.
- Does a batch choose colours for non-sheet materials (thread to match rexine)? If yes → `batch_material_choices` later.
- Rexine measurement at cutting (Q5) — decides when `adjust`/`waste` replaces "actual = planned".
