import type { Station } from "@rps/shared";

export type { Station, Worker } from "@rps/shared";

export interface CreateWorkerInput {
  name: string;
  phone?: string;
  station: Station;
  pin: string;
}
