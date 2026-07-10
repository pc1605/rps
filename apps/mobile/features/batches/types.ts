export type Phase = "cutting" | "stitching" | "packing" | "completed";

export interface Batch {
  id: string;
  batch_code: string;
  brand_name: string;
  model_name: string;
  size_class: string;
  quantity: number;
  current_phase: Phase;
  units_total: number;
  units_packed: number;
  notes?: string;
  created_at: string;
}
