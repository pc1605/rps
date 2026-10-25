export type {
  AssignmentEntry,
  AssignmentInput,
  Batch,
  BatchDetail,
  BatchStats,
  BatchStatus as Status,
  Phase,
  PhaseLogEntry,
  Unit,
  UnitStatus,
} from "@rps/shared";

export type { CarItem as CarModel } from "@/features/catalog/types";

// admin-only
export interface CreateBatchInput {
  car_model_id: number;
  roll_id?: string;
  quantity: number;
  notes?: string;
}

export interface Roll {
  id: string;
  roll_code: string;
  color: string;
  remaining_meters: number;
}
