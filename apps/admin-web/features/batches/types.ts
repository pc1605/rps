export type Phase = "cutting" | "stitching" | "packing" | "completed";
export type Status = "pending" | "in_progress" | "completed" | "cancelled";
export type UnitStatus = "pending" | "packed" | "defective" | "dispatched";

export interface Batch {
  id: string;
  batch_code: string;
  car_model_id: number;
  brand_name: string;
  model_name: string;
  size_class: string;
  roll_id?: string;
  roll_code?: string;
  quantity: number;
  current_phase: Phase;
  status: Status;
  notes?: string;
  rework_count: number;
  created_by: string;
  created_by_name?: string;
  version: number;
  created_at: string;
  updated_at: string;
  units_total: number;
  units_packed: number;
}

export interface Unit {
  id: string;
  batch_id: string;
  unit_code: string;
  unit_number: number;
  status: UnitStatus;
  packed_at?: string;
  created_at: string;
}

export interface BatchDetail extends Batch {
  units: Unit[];
}

export interface CreateBatchInput {
  car_model_id: number;
  roll_id?: string;
  quantity: number;
  notes?: string;
}

// Reference data for the create form
export interface CarModel {
  id: number;
  brand_name: string;
  name: string;
  size_class: string;
}

export interface Roll {
  id: string;
  roll_code: string;
  color: string;
  remaining_meters: number;
}

export interface BatchStats {
  in_cutting: number;
  in_stitching: number;
  in_packing: number;
  completed_today: number;
  total_active: number;
}
