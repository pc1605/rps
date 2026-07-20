import { http } from "../../lib/api-client";
import type { Batch } from "./types";

export const batchApi = {
  myBatches: async (): Promise<Batch[]> => {
    const res = await http.get("/worker/batches");
    return res.data?.data ?? res.data;
  },
  start: async (batchId: string): Promise<void> => {
    await http.post(`/worker/batches/${batchId}/start`);
  },
  complete: async (
    batchId: string,
    quantityCompleted: number,
    notes?: string,
  ): Promise<void> => {
    await http.post(`/worker/batches/${batchId}/complete`, {
      quantity_completed: quantityCompleted,
      notes,
    });
  },
};
