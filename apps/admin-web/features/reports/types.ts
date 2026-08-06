export interface WorkerProductivity {
  worker_id: string;
  worker_name: string;
  station: string;
  is_active: boolean;
  batches_done: number;
  pieces_done: number;
  avg_duration_secs: number;
  currently_working: boolean;
}

export interface WorkerReport {
  from: string;
  to: string;
  workers: WorkerProductivity[];
}
