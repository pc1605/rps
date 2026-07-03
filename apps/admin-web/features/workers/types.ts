export type Station = "cutter" | "stitcher" | "packer";

export interface Worker {
  id: string;
  name: string;
  phone?: string;
  station: Station;
  is_active: boolean;
  last_login_at?: string;
  created_at: string;
  badge_token?: string; // only present right after creation
}

export interface CreateWorkerInput {
  name: string;
  phone?: string;
  station: Station;
  pin: string;
}
