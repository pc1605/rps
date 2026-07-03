import { http } from "@/lib/api-client";
import type { Worker, CreateWorkerInput } from "./types";

export const workerApi = {
  list: async (): Promise<Worker[]> => {
    const res = await http.get("/workers");
    return res.data?.data ?? res.data;
  },
  create: async (input: CreateWorkerInput): Promise<Worker> => {
    const res = await http.post("/workers", input);
    return res.data?.data ?? res.data;
  },
};
