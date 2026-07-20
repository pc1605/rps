export type Phase = "cutting" | "stitching" | "packing" | "completed";
export type BatchStatus = "pending" | "in_progress" | "completed" | "cancelled";

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
  notes?: string;
  created_at: string;

  // Open claim on the current phase (present only when in_progress)
  active_worker_id?: string;
  active_worker_name?: string;
}
