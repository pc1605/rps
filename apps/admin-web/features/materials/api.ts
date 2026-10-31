import type { MaterialLotDetail, MaterialMovementPage } from "@rps/shared";
import { http } from "@/lib/api-client";

// Read-only for U1 (lot page). C2 adds the materials screens and their mutations.
export const materialsApi = {
  lot: async (id: string): Promise<MaterialLotDetail> => (await http.get(`/materials/lots/${id}`)).data.data,
  movements: async (params: {
    lot_id?: string;
    cursor?: string;
    limit?: number;
  }): Promise<MaterialMovementPage> =>
    (await http.get("/materials/movements", { params: { limit: 25, ...params } })).data.data,
};
