import type {
  BatchListParams,
  BatchPage,
  HandOverInput,
  HandOverResult,
  OpenStitching,
  SearchResult,
  ShortAction,
  ShortReason,
  StitcherLoad,
} from "@rps/shared";
import { http } from "@/lib/api-client";
import type {
  AssignmentInput,
  Batch,
  BatchDetail,
  BatchStats,
  CarModel,
  CreateBatchInput,
  Phase,
} from "./types";

export const batchApi = {
  /** One page of batches; every param is also URL state in the admin. */
  list: async (params: BatchListParams = {}): Promise<BatchPage> => {
    const res = await http.get("/batches", { params });
    return res.data.data;
  },
  search: async (q: string): Promise<SearchResult> =>
    (await http.get("/search", { params: { q } })).data.data,
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
  stats: async (): Promise<BatchStats> => {
    const res = await http.get("/batches/stats");
    return res.data?.data ?? res.data;
  },
  setAssignments: async (id: string, phase: Phase, assignments: AssignmentInput[]) => {
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
  resolveShort: async (id: string, action: ShortAction, reason: ShortReason, note?: string) => {
    const res = await http.post(`/batches/${id}/resolve-short`, { action, reason, note });
    return res.data?.data ?? res.data;
  },
  /** Active stitchers, least open work first (assign panel). */
  stitcherLoads: async (): Promise<StitcherLoad[]> => (await http.get("/stitchers/load")).data.data,
  openStitching: async (workerId: string): Promise<OpenStitching[]> =>
    (await http.get(`/stitchers/${workerId}/open`)).data.data,
  handOver: async (input: HandOverInput): Promise<HandOverResult[]> =>
    (await http.post("/stitching/hand-over", input)).data.data,
};
