import type { UnitJourney } from "@rps/shared";
import { http } from "@/lib/api-client";

export const unitApi = {
  journey: async (code: string): Promise<UnitJourney> =>
    (await http.get(`/units/${encodeURIComponent(code)}`)).data.data,
};
