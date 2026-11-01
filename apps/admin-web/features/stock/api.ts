import type { SpareStock, SpareWriteOffInput } from "@rps/shared";
import { http } from "@/lib/api-client";
import type { FinishedStock } from "./types";

export const stockApi = {
  finished: async (): Promise<FinishedStock[]> => {
    const res = await http.get("/stock/finished");
    return res.data?.data ?? res.data;
  },
  spares: async (carModelId?: number): Promise<SpareStock[]> =>
    (await http.get("/spares", { params: { car_model_id: carModelId } })).data.data,
  writeOffSpares: async (input: SpareWriteOffInput): Promise<{ unit_codes: string[] }> =>
    (await http.post("/spares/write-off", input)).data.data,
};
