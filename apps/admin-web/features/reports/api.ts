import type {
  QualityReport,
  ReportOverview,
  Settings,
  StuckBatch,
  StuckHours,
  WorkerOutputReport,
} from "@rps/shared";
import { http } from "@/lib/api-client";

const d = <T>(res: { data: { data?: T } }): T => res.data?.data as T;
const range = (from?: string, to?: string) => ({ params: { from: from || undefined, to: to || undefined } });

export const reportApi = {
  overview: async (from?: string, to?: string): Promise<ReportOverview> =>
    d(await http.get("/reports/overview", range(from, to))),
  stuck: async (): Promise<StuckBatch[]> => d(await http.get("/reports/stuck")),
  workerOutput: async (from?: string, to?: string): Promise<WorkerOutputReport> =>
    d(await http.get("/reports/worker-output", range(from, to))),
  quality: async (from?: string, to?: string): Promise<QualityReport> =>
    d(await http.get("/reports/quality", range(from, to))),
  settings: async (): Promise<Settings> => d(await http.get("/settings")),
  putStuckHours: async (h: StuckHours): Promise<StuckHours> => d(await http.put("/settings/stuck_hours", h)),
};
