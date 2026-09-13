import { http } from "@/lib/api-client";
import type {
  Batch,
  BatchDetail,
  CreateBatchInput,
  CarModel,
  Roll,
  Phase,
  AssignmentInput,
} from "./types";

export const batchApi = {
  list: async (): Promise<Batch[]> => {
    const res = await http.get("/batches");
    return res.data?.data ?? res.data;
  },
  get: async (id: string): Promise<BatchDetail> => {
    const res = await http.get(`/batches/${id}`);
    return res.data?.data ?? res.data;
  },
  create: async (input: CreateBatchInput): Promise<Batch> => {
    const res = await http.post("/batches", input);
    return res.data?.data ?? res.data;
  },
  carModels: async (): Promise<CarModel[]> => {
    const res = await http.get("/car-models");
    return res.data?.data ?? res.data;
  },
  rolls: async (): Promise<Roll[]> => {
    const res = await http.get("/rolls");
    return res.data?.data ?? res.data;
  },
  stats: async () => {
    const res = await http.get("/batches/stats");
    return res.data?.data ?? res.data;
  },
  setAssignments: async (
    id: string,
    phase: Phase,
    assignments: AssignmentInput[],
  ) => {
    const res = await http.put(`/batches/${id}/assignments`, {
      phase,
      assignments,
    });
    return res.data?.data ?? res.data;
  },
  markStickersPrinted: async (id: string) => {
    const res = await http.post(`/batches/${id}/stickers-printed`);
    return res.data?.data ?? res.data;
  },
};
