import type { WorkerDetail, WorkerHistoryPage, WorkerSummary, WorkerUpdateInput } from "@rps/shared";
import { http } from "@/lib/api-client";
import type { CreateWorkerInput, Worker } from "./types";

const d = <T>(res: { data: { data: T } }): T => res.data.data;

export const workerApi = {
  list: async (): Promise<Worker[]> => d(await http.get("/workers")),
  create: async (input: CreateWorkerInput): Promise<Worker> => d(await http.post("/workers", input)),
  detail: async (id: string): Promise<WorkerDetail> => d(await http.get(`/workers/${id}`)),
  summary: async (id: string, from: string, to: string): Promise<WorkerSummary> =>
    d(await http.get(`/workers/${id}/summary`, { params: { from, to } })),
  history: async (id: string, cursor?: string): Promise<WorkerHistoryPage> =>
    d(await http.get(`/workers/${id}/history`, { params: { limit: 20, cursor } })),
  update: async (id: string, input: WorkerUpdateInput): Promise<Worker> =>
    d(await http.patch(`/workers/${id}`, input)),
  /** Returns the new PIN once (random when `pin` is omitted). */
  resetPin: async (id: string, pin?: string): Promise<{ pin: string }> =>
    d(await http.post(`/workers/${id}/reset-pin`, pin ? { pin } : {})),
};
