import { http } from "@/lib/api-client";
import type { Roll, CreateRollInput, UpdateRollInput } from "./types";

export const stockApi = {
  list: async (): Promise<Roll[]> => {
    const res = await http.get("/stock/rolls");
    return res.data?.data ?? res.data;
  },
  create: async (input: CreateRollInput): Promise<Roll> => {
    const res = await http.post("/stock/rolls", input);
    return res.data?.data ?? res.data;
  },
  update: async (id: string, input: UpdateRollInput): Promise<Roll> => {
    const res = await http.patch(`/stock/rolls/${id}`, input);
    return res.data?.data ?? res.data;
  },
};
