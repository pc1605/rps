import type { MyWorkSummary } from "@rps/shared";
import { http } from "../../lib/api-client";

export const meApi = {
  summary: async (): Promise<MyWorkSummary> => (await http.get("/worker/me/summary")).data.data,
};
