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
  photos: ReworkPhoto[];
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
