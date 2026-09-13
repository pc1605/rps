export type Phase = "cutting" | "stitching" | "packing" | "completed";
export type BatchStatus =
  | "pending"
  | "in_progress"
  | "awaiting_assignment"
  | "completed"
  | "cancelled";

export interface Batch {
  id: string;
  batch_code: string;
  brand_name: string;
  model_name: string;
  size_class: string;
  quantity: number;
  current_phase: Phase;
  status: BatchStatus;
  units_total: number;
  units_packed: number;
  units_stitched: number;
  notes?: string;
  created_at: string;

  active_workers?: string;
  joined_by_me: boolean;

  // admin assignment for the current phase
  assigned_workers?: string; // "Mahesh, Surya"
  assigned_to_me: boolean;
  my_target_qty?: number;
  my_done_qty: number;
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
}
