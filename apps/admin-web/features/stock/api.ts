import { http } from "@/lib/api-client";
import type { FinishedStock } from "./types";

export const stockApi = {
  finished: async (): Promise<FinishedStock[]> => {
    const res = await http.get("/stock/finished");
    return res.data?.data ?? res.data;
  },
};
