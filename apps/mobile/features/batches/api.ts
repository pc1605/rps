import { http } from "../../lib/api-client";
import type { Batch } from "./types";

export const batchApi = {
  myBatches: async (): Promise<Batch[]> => {
    const res = await http.get("/worker/batches");
    return res.data?.data ?? res.data;
  },
};
