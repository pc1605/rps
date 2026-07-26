export interface Roll {
  id: string;
  roll_code: string;
  color: string;
  total_meters: number;
  remaining_meters: number;
  is_active: boolean;
  is_low: boolean;
  received_at: string;
  created_at: string;
  batch_count: number;
}

export interface CreateRollInput {
  roll_code: string;
  color: string;
  total_meters: number;
}

export interface UpdateRollInput {
  color?: string;
  total_meters?: number;
  remaining_meters?: number;
  is_active?: boolean;
}
