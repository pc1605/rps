import { http } from "@/lib/api-client";
import { WorkerReport } from "./types";

export const reportApi = {
  workers: async (from?: string, to?: string): Promise<WorkerReport> => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await http.get(`/reports/workers?${params.toString()}`);
    return res.data?.data ?? res.data;
  },
};
