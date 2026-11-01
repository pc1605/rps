// Mirrors apps/backend JSON. Change both together.

export type Phase = "cutting" | "stitching" | "packing" | "completed";
export type BatchStatus = "pending" | "in_progress" | "awaiting_assignment" | "completed" | "cancelled";
/** "spare": a cut or stitched mat from a cancelled batch, kept as spare stock (U3). */
export type UnitStatus = "pending" | "packed" | "defective" | "dispatched" | "rework" | "spare";
export type Station = "cutter" | "stitcher" | "packer";
export type SizeClass = "small" | "medium" | "large";

/** Why a short cut was resolved the way it was (W5). Required for split, reduce and re-cut. */
export type ShortReason =
  "roll_ran_out" | "material_defect" | "machine_issue" | "cutter_error" | "order_changed" | "other";
export type ShortAction = "split" | "reduce" | "recut";
export type CancelReason =
  "order_cancelled" | "order_changed" | "created_by_mistake" | "material_problem" | "other";

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
  flagged_by: string;
  flagged_by_name: string;
  flagged_at: string;
  decision?: ReworkDecision;
  decided_at?: string;
  fixed_by?: string;
  fixed_by_name?: string;
  fixed_at?: string;
  stitcher_id?: string;
  stitcher_name?: string;
  photos: ReworkPhoto[];
  new_batch_code?: string;
  /** Set on a recut decision: the new 1-mat batch. */
  new_batch_id?: string;
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
  /** GET /batches only: for an awaiting_assignment batch, when cutting last finished (waiting time). */
  ready_since?: string;
}

export interface Unit {
  id: string;
  batch_id: string;
  unit_code: string;
  unit_number: number;
  status: UnitStatus;
  created_at: string;
  stitched_at?: string;
  stitched_by?: string;
  stitched_by_name?: string;
  packed_at?: string;
  packed_by?: string;
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

/** PATCH /batches/:id — only while the batch waits to be cut. Omitted = unchanged; roll_id "" clears it. */
export interface BatchEditInput {
  car_model_id?: number;
  quantity?: number;
  roll_id?: string;
  notes?: string;
}

/** GET /batches/:id/cancel-preview and POST /batches/:id/cancel — what cancelling does to the mats. */
export interface CancelOutcome {
  /** Stitched mats → spare stock (they keep their unit code). */
  spare_stitched: number;
  /** Cut, not yet stitched → spare stock. */
  spare_unstitched: number;
  /** Never cut → removed. */
  removed: number;
  /** In open rework → written off. */
  written_off: number;
  already_written_off: number;
  /** Set when the batch can't be cancelled (e.g. a mat is already packed). */
  blocked?: string;
}

export interface CancelBatchInput {
  reason: CancelReason;
  note?: string;
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
  /** Who's working now, per phase (open logs at the batch's current phase). */
  working: Partial<Record<Phase, string[]>>;
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

export type PeekReason =
  "already_packed" | "in_rework" | "written_off" | "spare" | "wrong_phase" | "not_started";

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
  /** Recipe lines (any product line × group) that use the type. */
  recipe_lines: number;
  /** Cars with an override for the type. */
  override_cars: number;
  /** Any lot, movement or batch plan row — such a type can only be deactivated. */
  has_history: boolean;
  /** Nothing references it: DELETE /materials/types/:id is allowed. */
  deletable: boolean;
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
  /** Lines across this group's recipes (all product lines). */
  recipe_lines: number;
  /** No cars, no recipe lines, not a size default: DELETE /consumption-groups/:id is allowed. */
  deletable: boolean;
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

// ───── Worker page (U1) ─────

/** GET /workers/:id */
export interface WorkerDetail extends Worker {
  open_claims: {
    batch_id: string;
    batch_code: string;
    car_name: string;
    phase: Phase;
    started_at: string;
    my_done: number;
    target_qty?: number;
  }[];
  /** Assigned at the batch's current phase but not joined yet. */
  assigned: {
    batch_id: string;
    batch_code: string;
    car_name: string;
    phase: Phase;
    target_qty?: number;
    my_done: number;
  }[];
  /** Open rework rounds on mats this worker stitched. */
  open_rework: {
    id: string;
    unit_code: string;
    batch_id: string;
    batch_code: string;
    round: number;
    reasons: ReworkReason[];
    flagged_at: string;
    awaiting_decision: boolean;
  }[];
}

export interface WorkerDayOutput {
  day: string; // YYYY-MM-DD (factory time)
  mats: number;
  first_at?: string;
  last_at?: string;
  /** Stitch/pack: first → last scan; cutting: Σ(complete − start). */
  active_seconds: number;
}

/** GET /workers/:id/summary?from&to (factory days, inclusive; default last 14) */
export interface WorkerSummary {
  worker_id: string;
  station: Station;
  from: string;
  to: string;
  unit: "pieces cut" | "mats stitched" | "mats packed";
  total: number;
  today: number;
  last_7_days: number;
  mats_per_hour?: number;
  days: WorkerDayOutput[];
  /** Stitchers: rounds flagged on their mats in range; rate = rounds / mats stitched in range. */
  rework_caused?: {
    rounds: number;
    rate_pct: number | null;
    by_reason: Partial<Record<ReworkReason, number>>;
  };
  rework_fixed?: { count: number; median_turnaround_secs?: number };
  /** Packers: rounds they flagged in range. */
  flagged?: number;
}

/** GET /stitchers/load — one active stitcher's workload (assign panel, U3). Sorted least open work first. */
export interface StitcherLoad {
  worker_id: string;
  name: string;
  /** Mats still to stitch in live stitching batches. Shared-pile batches count every unstitched mat. */
  open_mats: number;
  open_batches: number;
  /** Has joined a live stitching batch right now. */
  on_floor: boolean;
  last_scan_at: string | null;
  /** Stitched since the start of the factory day. */
  mats_today: number;
}

/** GET /stitchers/:id/open — a stitcher's live stitching assignments (hand-over dialog). */
export interface OpenStitching {
  batch_id: string;
  batch_code: string;
  car_name: string;
  quantity: number;
  /** null = shared pile */
  target_qty: number | null;
  done_qty: number;
  /** Quota: target − done. Shared pile: unstitched mats of the batch. */
  left_qty: number;
}

/** POST /stitching/hand-over body. */
export interface HandOverInput {
  from_worker_id: string;
  moves: { batch_id: string; to_worker_id: string }[];
}

/** POST /stitching/hand-over response row. `moved` is 0 for a shared-pile batch. */
export interface HandOverResult {
  batch_id: string;
  batch_code: string;
  moved: number;
}

export interface WorkerHistoryRow {
  phase_log_id: string;
  batch_id: string;
  batch_code: string;
  car_model_id: number;
  car_name: string;
  phase: Phase;
  started_at: string;
  completed_at?: string;
  /** Cutting: pieces reported; stitching/packing: mats this worker scanned. */
  mats: number;
  target_qty?: number;
  first_scan_at?: string;
  last_scan_at?: string;
  rework_caused: number;
}

/** GET /workers/:id/history?limit&cursor */
export interface WorkerHistoryPage {
  items: WorkerHistoryRow[];
  next_cursor?: string;
}

/** PATCH /workers/:id — station change / deactivation → 409 worker_busy while the worker has open work. */
export interface WorkerUpdateInput {
  name?: string;
  /** "" clears. */
  phone?: string;
  station?: Station;
  is_active?: boolean;
}

// ───── Entity pages (U1) ─────

/** GET /units/:code */
export interface UnitJourney {
  unit: Unit;
  batch: Batch;
  /** The batch's cutting completions (mats aren't scanned at cutting). */
  cutting: PhaseLogEntry[];
}

export interface CarOverviewBatch {
  id: string;
  batch_code: string;
  quantity: number;
  current_phase: Phase;
  status: BatchStatus;
  units_packed: number;
  rework_open: number;
  created_at: string;
}

/** GET /car-models/:id/overview?from&to (factory days, inclusive; default last 30) */
export interface CarOverview {
  car: {
    id: number;
    brand_name: string;
    name: string;
    size_class: SizeClass;
    pieces_per_set: number;
    product_line_id?: number;
    line_code?: string;
    line_name?: string;
    barcode?: string;
    is_active: boolean;
    consumption_group_id: number;
    consumption_group_name: string;
  };
  stats: {
    from: string;
    to: string;
    stitched: number;
    packed: number;
    rework_rounds: number;
    /** rounds / stitched in range × 100 */
    rework_rate: number | null;
    /** packed in range with no rework round / packed in range × 100 */
    first_pass: number | null;
    /** Mats of batches not completed/cancelled (now). */
    in_wip: number;
    /** Packed, not dispatched (now). */
    in_stock: number;
  };
  active_batches: CarOverviewBatch[];
  recent_completed: CarOverviewBatch[];
}

/** GET /materials/lots/:id — ledger itself: GET /materials/movements?lot_id= */
export interface MaterialLotDetail extends MaterialLotRow {
  consumed: number;
  wasted: number;
  /** Signed sum of adjustments. */
  adjusted: number;
  returned: number;
  /** Batches that chose this lot as their roll or drew from it. */
  batches: {
    batch_id: string;
    batch_code: string;
    car_name: string;
    quantity: number;
    current_phase: Phase;
    drawn: number;
    created_at: string;
  }[];
}

// ───── Lists & search (U2) ─────

export type BatchListView = "cutting" | "ready" | "stitching" | "packing" | "completed" | "cancelled";
export type BatchSort = "created" | "code" | "quantity" | "phase" | "car" | "waiting";

/** GET /batches query params — every one is also the admin's URL state. */
export interface BatchListParams {
  view?: BatchListView;
  /** Batch code, car (brand + model), product line name, or exact barcode. */
  q?: string;
  car_model_id?: number;
  product_line_id?: number;
  /** Created between factory days (inclusive). */
  from?: string;
  to?: string;
  has_rework?: boolean;
  short?: boolean;
  sort?: BatchSort;
  order?: "asc" | "desc";
  page?: number;
  /** 1–200, default 50. */
  limit?: number;
}

/** GET /batches */
export interface BatchPage {
  items: Batch[];
  total: number;
  page: number;
  limit: number;
}

export type SearchKind = "batch" | "unit" | "car" | "worker" | "lot";

export interface SearchHit {
  kind: SearchKind;
  /** batch/worker/lot uuid, car id, or the unit code. */
  id: string;
  label: string;
  sub: string;
}

/** GET /search?q= (≥ 2 chars; ≤ 5 hits per kind) */
export interface SearchResult {
  q: string;
  /** Full batch / unit / lot code or barcode match — open it directly (scanner input). */
  exact?: SearchHit;
  hits: SearchHit[];
}

// ───── Reports v2 (R1) — days are factory-local (FACTORY_TZ), `from`/`to` inclusive ─────

/** Where a live batch sits. */
export type ReportStage = "cutting" | "awaiting_assignment" | "stitching" | "packing";

/** app_settings "stuck_hours": idle hours before a batch counts as stuck, per stage. */
export interface StuckHours {
  cutting: number;
  awaiting_assignment: number;
  stitching: number;
  packing: number;
}

export interface Settings {
  stuck_hours: StuckHours;
}

export interface ReportRange {
  from: string;
  to: string;
}

export interface ThroughputDay {
  day: string;
  cut: number;
  stitched: number;
  packed: number;
}

export interface ThroughputTotals {
  cut: number;
  stitched: number;
  packed: number;
}

export interface WipStage {
  stage: ReportStage;
  batches: number;
  mats: number;
  /** Batches by time since entering the stage: <4 h, 4–24 h, 1–3 d, >3 d. */
  ageing: [number, number, number, number];
  stuck: number;
}

export interface FpyWeek {
  /** Monday of the week. */
  week: string;
  packed: number;
  first_pass: number;
}

export interface ItemMixRow {
  car_model_id: number;
  car_name: string;
  product_line?: string;
  packed: number;
}

/** GET /reports/overview?from&to (default last 30 days). */
export interface ReportOverview {
  range: ReportRange;
  days: ThroughputDay[];
  totals: ThroughputTotals;
  /** Same number of days just before `from`. */
  previous: ThroughputTotals;
  wip: WipStage[];
  stuck_count: number;
  fpy_packed: number;
  fpy_first_pass: number;
  fpy_weeks: FpyWeek[];
  items: ItemMixRow[];
  stuck_hours: StuckHours;
}

/** GET /reports/stuck — live batches idle past their stage's threshold, longest idle first. */
export interface StuckBatch {
  batch_id: string;
  batch_code: string;
  car_name: string;
  quantity: number;
  stage: ReportStage;
  entered_at: string;
  last_activity_at: string;
  idle_hours: number;
  threshold_hours: number;
}

export interface WorkerOutputRow {
  worker_id: string;
  worker_name: string;
  station: Station;
  is_active: boolean;
  /** Cutters: pieces cut. Stitchers/packers: mats scanned. */
  mats: number;
  days_worked: number;
  /** Cutters: start → complete. Others: first → last scan per day, summed. */
  active_secs: number;
  /** Only with ≥ 15 min active. */
  mats_per_hour?: number;
  rework_rounds: number;
  quota_target: number;
  quota_done: number;
  quota_batches: number;
  currently_open: number;
}

/** GET /reports/worker-output?from&to (default last 7 days). */
export interface WorkerOutputReport {
  range: ReportRange;
  workers: WorkerOutputRow[];
}

export interface ReasonCount {
  reason: string;
  count: number;
}

/** GET /reports/quality?from&to (default last 30 days). */
export interface QualityReport {
  range: ReportRange;
  rework_rounds: number;
  by_reason: ReasonCount[];
  by_stitcher: { worker_id: string; worker_name: string; rounds: number; stitched: number }[];
  fixed_count: number;
  avg_fix_hours?: number;
  cut_completions: number;
  short_cuts: { action: ShortAction; reason: ShortReason | "unknown"; count: number }[];
  losses: { decision: "write_off" | "recut"; car_model_id: number; car_name: string; count: number }[];
  loss_by_reason: ReasonCount[];
}
