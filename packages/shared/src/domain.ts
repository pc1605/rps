// Mirrors apps/backend JSON. Change both together.

export type Phase = "cutting" | "stitching" | "packing" | "completed";
export type BatchStatus = "pending" | "in_progress" | "awaiting_assignment" | "completed" | "cancelled";
export type UnitStatus = "pending" | "packed" | "defective" | "dispatched" | "rework";
export type Station = "cutter" | "stitcher" | "packer";
export type SizeClass = "small" | "medium" | "large";

export type ReworkReason = "stitching_fault" | "stain" | "cutting_fault" | "material_defect" | "other";
export type ReworkRoute = "stitcher" | "admin";
export type ReworkDecision = "to_stitcher" | "recut" | "write_off";

export interface ReworkPhoto {
  id: string;
  url: string;
}

export interface ReworkEntry {
  id: string;
  unit_id: string;
  unit_code?: string;
  batch_id: string;
  batch_code?: string;
  brand_name?: string;
  model_name?: string;
  size_class?: SizeClass;
  line_name?: string;
  round: number;
  reasons: ReworkReason[];
  note?: string;
  route: ReworkRoute;
  flagged_by_name: string;
  flagged_at: string;
  decision?: ReworkDecision;
  decided_at?: string;
  fixed_by_name?: string;
  fixed_at?: string;
  stitcher_name?: string;
  photos: ReworkPhoto[];
  new_batch_code?: string;
}

export interface Batch {
  id: string;
  batch_code: string;
  car_model_id: number;
  brand_name: string;
  model_name: string;
  size_class: SizeClass;
  line_code?: string;
  line_name?: string;
  barcode?: string;
  roll_id?: string;
  roll_code?: string;
  quantity: number;
  cut_qty: number;
  current_phase: Phase;
  status: BatchStatus;
  notes?: string;
  rework_count: number;
  rework_open?: number;
  created_by: string;
  created_by_name?: string;
  version: number;
  created_at: string;
  updated_at: string;
  stickers_printed_at?: string;
  parent_batch_id?: string;
  parent_batch_code?: string;
  short_reason?: string;
  units_total: number;
  units_packed: number;
  units_stitched?: number;
  /** Mats written off as defective — never packed, but they do not block completion. */
  units_written_off: number;
  active_workers?: string;
  // worker-queue only (GET /worker/batches)
  joined_by_me?: boolean;
  assigned_workers?: string;
  assigned_to_me?: boolean;
  my_target_qty?: number;
  my_done_qty?: number;
}

export interface Unit {
  id: string;
  batch_id: string;
  unit_code: string;
  unit_number: number;
  status: UnitStatus;
  created_at: string;
  stitched_at?: string;
  stitched_by_name?: string;
  packed_at?: string;
  packed_by_name?: string;
  rework?: ReworkEntry[];
}

export interface PhaseLogEntry {
  id: string;
  phase: Phase;
  worker_id: string;
  worker_name: string;
  started_at: string;
  completed_at?: string;
  duration_seconds?: number;
  quantity_completed?: number;
  notes?: string;
}

export interface AssignmentEntry {
  phase: Phase;
  worker_id: string;
  worker_name: string;
  target_qty?: number;
  done_qty: number;
}

export interface AssignmentInput {
  worker_id: string;
  target_qty?: number;
}

export interface BatchDetail extends Batch {
  units: Unit[];
  timeline: PhaseLogEntry[];
  assignments: AssignmentEntry[];
}

export interface BatchStats {
  in_cutting: number;
  awaiting_assignment: number;
  in_stitching: number;
  in_packing: number;
  completed_today: number;
  total_active: number;
  rework_open: number;
  rework_needs_decision: number;
  /** Shortfall movements (consumed more than stock held) in the last 30 days. */
  material_shortfalls_open: number;
  /** Active material types whose active lots sum below min_level. */
  low_stock_types: number;
}

export interface ScanResult {
  unit_code: string;
  batch_code: string;
  phase: "stitching" | "packing";
  already_done: boolean;
  done_count: number;
  total_units: number;
  phase_completed: boolean;
  batch_completed: boolean;
  rework_fixed?: boolean;
}

export interface Worker {
  id: string;
  name: string;
  phone?: string;
  station: Station;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  badge_token?: string; // only on create
}

export type PeekReason = "already_packed" | "in_rework" | "written_off" | "wrong_phase" | "not_started";

export interface UnitPeek {
  unit_code: string;
  batch_id: string;
  batch_code: string;
  status: UnitStatus;
  batch_phase: Phase;
  batch_status: BatchStatus;
  joined: boolean;
  can_pack: boolean;
  can_rework: boolean;
  reason?: PeekReason;
}

// ───── Materials (migration 015 · design: docs/rps-kb/02-domain/materials.md) ─────
// Row shapes for the C1c endpoints. Numeric quantities arrive as JSON numbers.

export type MaterialUnit = "m" | "sqm" | "pcs" | "spool" | "kg";
export type MovementKind = "receive" | "consume" | "adjust" | "waste" | "return";
/** Which rule produced a planned quantity (most specific first). */
export type PlanSource = "car_variant" | "car_any" | "recipe_variant" | "recipe_any" | "none";

export interface MaterialType {
  id: number;
  code: string; // e.g. "REX-R", "VELCRO"
  name: string;
  unit: MaterialUnit;
  has_variants: boolean;
  /** Low stock when the sum of active lots' qty_remaining is below this. */
  min_level?: number;
  sort: number;
  is_active: boolean;
}

/** Specs that change consumption (e.g. roll width) — never colour; colour is on the lot. */
export interface MaterialVariant {
  id: number;
  material_type_id: number;
  name: string; // e.g. "60″"
  specs: Record<string, unknown>; // e.g. { width_in: 60 }
  is_active: boolean;
}

/** One received quantity of a material (a roll, a box). Formerly raw_materials (rolls). */
export interface MaterialLot {
  id: string;
  lot_code: string;
  material_type_id: number;
  variant_id?: number;
  color: string;
  qty_received: number;
  /** Cached; always equals the sum of the lot's movements. */
  qty_remaining: number;
  unit_cost?: number; // ₹ per unit
  supplier?: string;
  note?: string;
  is_active: boolean;
  received_at: string;
  created_at: string;
}

/** Append-only ledger row. qty is signed (+ in, − out). lot_id absent = shortfall. */
export interface MaterialMovement {
  id: string;
  lot_id?: string;
  material_type_id: number;
  variant_id?: number;
  kind: MovementKind;
  qty: number;
  batch_id?: string;
  /** Cutting completion that consumed it (consume / shortfall rows). */
  phase_log_id?: string;
  reason?: string;
  actor_user_id?: string;
  actor_worker_id?: string;
  created_at: string;
}

export interface ConsumptionGroup {
  id: number;
  name: string; // "Small", "Medium", "Large", "XL 7-seater"…
  sort: number;
  is_active: boolean;
  /** New cars of this size class default to this group. */
  default_for_size?: SizeClass;
}

/** Recipe key: product line × consumption group. */
export interface Recipe {
  id: number;
  product_line_id: number;
  consumption_group_id: number;
  note?: string;
  lines: RecipeLine[];
}

export interface RecipeLine {
  id: number;
  recipe_id: number;
  material_type_id: number;
  /** Absent = default for any variant. */
  variant_id?: number;
  qty_per_mat: number;
}

export interface CarMaterialOverride {
  id: number;
  car_model_id: number;
  material_type_id: number;
  /** Absent = any variant. */
  variant_id?: number;
  /** 0 = this car doesn't use the material. */
  qty_per_mat: number;
}

/** Recipe snapshot written at each cutting completion (planned vs actual, R2). */
export interface BatchMaterialPlanLine {
  id: string;
  batch_id: string;
  phase_log_id?: string;
  material_type_id: number;
  variant_id?: number;
  source: PlanSource;
  qty_per_mat?: number; // absent when source = "none"
  mats: number;
  planned_qty?: number; // absent when source = "none"
  note?: string;
  created_at: string;
}

// ───── Materials API (C1c) — response rows + inputs ─────

/** GET /materials/types */
export interface MaterialTypeRow extends Omit<MaterialType, "min_level"> {
  min_level?: number;
  /** Sum of active lots' qty_remaining. */
  stock_remaining: number;
  active_lots: number;
  is_low: boolean;
  created_at: string;
}

export interface MaterialVariantRow extends MaterialVariant {
  created_at: string;
}

/** GET /materials/lots */
export interface MaterialLotRow extends MaterialLot {
  type_code: string;
  type_name: string;
  unit: MaterialUnit;
  variant_name?: string;
  last_movement_at?: string;
}

/** GET /materials/movements item */
export interface MaterialMovementRow extends MaterialMovement {
  lot_code?: string;
  color?: string;
  type_code: string;
  type_name: string;
  unit: MaterialUnit;
  variant_name?: string;
  batch_code?: string;
  actor_user_name?: string;
  actor_worker_name?: string;
}

export interface MaterialMovementPage {
  items: MaterialMovementRow[];
  /** Pass as ?cursor= for the next (older) page. */
  next_cursor?: string;
}

export interface MaterialTypeInput {
  code?: string;
  name?: string;
  unit?: MaterialUnit;
  has_variants?: boolean;
  /** null clears. */
  min_level?: number | null;
  sort?: number;
  is_active?: boolean;
}

export interface MaterialVariantInput {
  name?: string;
  specs?: Record<string, unknown>;
  is_active?: boolean;
}

/** POST /materials/lots (receive) */
export interface ReceiveLotInput {
  material_type_id: number;
  /** Required iff the type has variants. */
  variant_id?: number;
  lot_code: string;
  color: string;
  qty: number;
  unit_cost?: number;
  supplier?: string;
  note?: string;
}

/** POST /materials/lots/:id/adjust */
export interface AdjustLotInput {
  new_remaining: number;
  reason: string;
}

/** POST /materials/lots/:id/waste | /return */
export interface LotQtyReasonInput {
  qty: number;
  reason: string;
}

/** PATCH /materials/lots/:id — type/variant only before any consumption/waste/return. null clears. */
export interface LotPatchInput {
  is_active?: boolean;
  color?: string;
  supplier?: string | null;
  note?: string | null;
  unit_cost?: number | null;
  material_type_id?: number;
  variant_id?: number | null;
}

/** GET /consumption-groups */
export interface ConsumptionGroupRow extends ConsumptionGroup {
  car_count: number;
  created_at: string;
}

export interface ConsumptionGroupInput {
  name?: string;
  sort?: number;
  /** Deactivating fails (409) while cars use the group or it is a size default. */
  is_active?: boolean;
  /** null clears. */
  default_for_size?: SizeClass | null;
}

/** A recipe line or car override as returned by the API (names joined in). */
export interface MaterialLineRow {
  id: number;
  material_type_id: number;
  type_code: string;
  type_name: string;
  unit: MaterialUnit;
  variant_id?: number;
  variant_name?: string;
  qty_per_mat: number;
}

/** PUT /recipes/:product_line_id/:group_id/lines and PUT /car-models/:id/material-overrides body item. */
export interface MaterialLineInput {
  material_type_id: number;
  /** Absent = any variant. */
  variant_id?: number;
  /** Recipes: > 0. Overrides: ≥ 0 (0 = this car doesn't use it). */
  qty_per_mat: number;
}

export interface RecipeGridGroup {
  group: ConsumptionGroupRow;
  /** Absent when no recipe exists yet for this line × group. */
  recipe_id?: number;
  note?: string;
  lines: MaterialLineRow[];
}

/** GET /recipes?product_line_id= */
export interface RecipeGrid {
  product_line: { id: number; code: string; name: string };
  groups: RecipeGridGroup[];
}

/** GET/PUT /car-models/:id/material-overrides */
export interface CarMaterialOverrides {
  car_model_id: number;
  lines: MaterialLineRow[];
}

/** One planned take from a lot. */
export interface PlanDraw {
  lot_id: string;
  lot_code: string;
  color: string;
  variant_id?: number;
  variant_name?: string;
  qty: number;
}

/** Planner outcome for one material type (engine and dry runs share it). */
export interface PlanLineResult {
  material_type_id: number;
  type_code: string;
  type_name: string;
  unit: MaterialUnit;
  /** Variant the quantity was resolved for (the roll's, or the first FIFO lot's). */
  variant_id?: number;
  variant_name?: string;
  source: PlanSource;
  qty_per_mat?: number; // absent when source = "none"
  need?: number; // absent when source = "none"
  /** Stock in the lots this type may draw from. */
  available: number;
  /** need − drawn; > 0 = a cut now would record a shortfall. */
  shortfall: number;
  draws: PlanDraw[];
  note?: string;
}

/** GET /recipes/resolve?car_model_id&quantity&lot_id — dry run, no writes. */
export interface MaterialsResolveResult {
  car_model_id: number;
  quantity: number;
  lot_id?: string;
  lines: PlanLineResult[];
  /** No-recipe and shortfall messages the engine would add to the batch notes. */
  notes: string[];
}

export interface BatchMaterialPlanRow extends Omit<BatchMaterialPlanLine, "batch_id"> {
  type_code: string;
  type_name: string;
  unit: MaterialUnit;
  variant_name?: string;
}

export interface BatchMaterialsCompletion {
  /** Absent = rows not linked to a cutting completion. */
  phase_log_id?: string;
  completed_at?: string;
  worker_name?: string;
  mats?: number;
  plan: BatchMaterialPlanRow[];
  /** consume rows; lot_id absent = shortfall. */
  movements: MaterialMovementRow[];
}

/** GET /batches/:id/materials */
export interface BatchMaterials {
  batch_id: string;
  batch_code: string;
  completions: BatchMaterialsCompletion[];
}

/** GET /worker/batches/:id/materials-needed (cutter) — for the mats still to cut. */
export interface MaterialsNeeded {
  batch_id: string;
  batch_code: string;
  /** Remaining mats to cut (0 once cutting is done). */
  mats: number;
  lines: {
    material_type_id: number;
    type_name: string;
    unit: MaterialUnit;
    source: PlanSource;
    need?: number;
    lots: { lot_code: string; color: string; width?: string; qty: number }[];
    shortfall: number;
  }[];
  notes: string[];
}
