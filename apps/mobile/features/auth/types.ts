export type Station = "cutter" | "stitcher" | "packer";

export interface Worker {
  id: string;
  name: string;
  station: Station;
}

export interface WorkerLoginResponse {
  worker: Worker;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
