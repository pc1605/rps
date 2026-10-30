import type { AxiosResponse } from "axios";
import type { ReworkDecision, ReworkEntry } from "@rps/shared";
import { http } from "@/lib/api-client";

type Envelope<T> = { data: T };

/** Unwrap the backend's {"data": …} envelope. */
const d = <T>(r: AxiosResponse<Envelope<T>>): T => r.data.data;

export interface ListReworkParams {
  status?: "open" | "all";
  route?: "admin" | "stitcher";
}

export async function listRework(params?: ListReworkParams): Promise<ReworkEntry[]> {
  return d(await http.get<Envelope<ReworkEntry[]>>("/rework", { params }));
}

export async function decideRework(
  id: string,
  decision: ReworkDecision,
  note?: string,
): Promise<ReworkEntry> {
  return d(await http.post<Envelope<ReworkEntry>>(`/rework/${id}/decide`, { decision, note }));
}

export const reworkApi = {
  list: listRework,
  decide: decideRework,
};
