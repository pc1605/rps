import type { UndoScanResult, UnitJourney } from "@rps/shared";
import { http } from "@/lib/api-client";

export const unitApi = {
  journey: async (code: string): Promise<UnitJourney> =>
    (await http.get(`/units/${encodeURIComponent(code)}`)).data.data,
  undoScan: async (code: string, reason: string): Promise<UndoScanResult> =>
    (await http.post(`/units/${encodeURIComponent(code)}/undo-scan`, { reason })).data.data,
};
