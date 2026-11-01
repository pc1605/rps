import { http } from "../../lib/api-client";
import type { Batch, ScanResult, UnitPeek } from "./types";

export const peekUnit = async (unitCode: string): Promise<UnitPeek> => {
  const res = await http.get(`/worker/units/${encodeURIComponent(unitCode)}/peek`);
  return res.data?.data ?? res.data;
};

export const batchApi = {
  myBatches: async (): Promise<Batch[]> => {
    const res = await http.get("/worker/batches");
    return res.data?.data ?? res.data;
  },
  start: async (batchId: string): Promise<void> => {
    await http.post(`/worker/batches/${batchId}/start`);
  },
  complete: async (batchId: string, quantityCompleted: number, notes?: string): Promise<void> => {
    await http.post(`/worker/batches/${batchId}/complete`, {
      quantity_completed: quantityCompleted,
      notes,
    });
  },
  /** Cutter gives back their own cutting claim (before reporting the cut). */
  release: async (batchId: string): Promise<void> => {
    await http.post(`/worker/batches/${batchId}/release`);
  },
  scanUnit: async (unitCode: string): Promise<ScanResult> => {
    const res = await http.post("/worker/units/scan", { unit_code: unitCode });
    return res.data?.data ?? res.data;
  },
  peekUnit,
};
