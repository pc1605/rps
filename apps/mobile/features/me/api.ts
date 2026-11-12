import type { MyWorkHistory, MyWorkSummary } from "@rps/shared";
import { http } from "../../lib/api-client";

export const meApi = {
  summary: async (): Promise<MyWorkSummary> => (await http.get("/worker/me/summary")).data.data,
  /** One month of the worker's own counts; no month = the current factory month. */
  history: async (month?: string): Promise<MyWorkHistory> =>
    (await http.get("/worker/me/history", { params: month ? { month } : undefined })).data.data,
};
