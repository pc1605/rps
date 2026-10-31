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
