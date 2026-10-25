import type { Worker } from "@rps/shared";

export type { Station, Worker } from "@rps/shared";

export interface WorkerLoginResponse {
  worker: Worker;
  tokens: {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };
}
