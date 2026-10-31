import type {
  AdjustLotInput,
  BatchMaterials,
  CarMaterialOverrides,
  ConsumptionGroupInput,
  ConsumptionGroupRow,
  LotPatchInput,
  LotQtyReasonInput,
  MaterialLineInput,
  MaterialLotDetail,
  MaterialLotRow,
  MaterialMovementPage,
  MaterialsResolveResult,
  MaterialTypeInput,
  MaterialTypeRow,
  MaterialVariantInput,
  MaterialVariantRow,
  ReceiveLotInput,
  RecipeGrid,
  RecipeGridGroup,
} from "@rps/shared";
import { http } from "@/lib/api-client";

const d = <T>(res: { data: { data: T } }): T => res.data.data;

export type LotFilter = { type_id?: number; active?: boolean; low?: boolean };
export type MovementFilter = {
  lot_id?: string;
  type_id?: number;
  batch_id?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
};

export const materialsApi = {
  // types & variants
  types: async (): Promise<MaterialTypeRow[]> => d(await http.get("/materials/types")),
  createType: async (i: MaterialTypeInput): Promise<MaterialTypeRow> =>
    d(await http.post("/materials/types", i)),
  updateType: async (id: number, i: MaterialTypeInput): Promise<MaterialTypeRow> =>
    d(await http.patch(`/materials/types/${id}`, i)),
  variants: async (typeId: number): Promise<MaterialVariantRow[]> =>
    d(await http.get(`/materials/types/${typeId}/variants`)),
  createVariant: async (typeId: number, i: MaterialVariantInput): Promise<MaterialVariantRow> =>
    d(await http.post(`/materials/types/${typeId}/variants`, i)),
  updateVariant: async (id: number, i: MaterialVariantInput): Promise<MaterialVariantRow> =>
    d(await http.patch(`/materials/variants/${id}`, i)),

  // lots
  lots: async (f: LotFilter = {}): Promise<MaterialLotRow[]> =>
    d(await http.get("/materials/lots", { params: f })),
  lot: async (id: string): Promise<MaterialLotDetail> => d(await http.get(`/materials/lots/${id}`)),
  receive: async (i: ReceiveLotInput): Promise<MaterialLotRow> => d(await http.post("/materials/lots", i)),
  adjust: async (id: string, i: AdjustLotInput): Promise<MaterialLotRow> =>
    d(await http.post(`/materials/lots/${id}/adjust`, i)),
  waste: async (id: string, i: LotQtyReasonInput): Promise<MaterialLotRow> =>
    d(await http.post(`/materials/lots/${id}/waste`, i)),
  return: async (id: string, i: LotQtyReasonInput): Promise<MaterialLotRow> =>
    d(await http.post(`/materials/lots/${id}/return`, i)),
  patchLot: async (id: string, i: LotPatchInput): Promise<MaterialLotRow> =>
    d(await http.patch(`/materials/lots/${id}`, i)),

  // ledger
  movements: async (f: MovementFilter): Promise<MaterialMovementPage> =>
    d(await http.get("/materials/movements", { params: { limit: 25, ...f } })),

  // consumption groups, recipes, overrides
  groups: async (): Promise<ConsumptionGroupRow[]> => d(await http.get("/consumption-groups")),
  createGroup: async (i: ConsumptionGroupInput): Promise<ConsumptionGroupRow> =>
    d(await http.post("/consumption-groups", i)),
  updateGroup: async (id: number, i: ConsumptionGroupInput): Promise<ConsumptionGroupRow> =>
    d(await http.patch(`/consumption-groups/${id}`, i)),
  recipeGrid: async (productLineId: number): Promise<RecipeGrid> =>
    d(await http.get("/recipes", { params: { product_line_id: productLineId } })),
  putRecipeLines: async (
    lineId: number,
    groupId: number,
    lines: MaterialLineInput[],
  ): Promise<RecipeGridGroup> => d(await http.put(`/recipes/${lineId}/${groupId}/lines`, lines)),
  overrides: async (carId: number): Promise<CarMaterialOverrides> =>
    d(await http.get(`/car-models/${carId}/material-overrides`)),
  putOverrides: async (carId: number, lines: MaterialLineInput[]): Promise<CarMaterialOverrides> =>
    d(await http.put(`/car-models/${carId}/material-overrides`, lines)),
  resolve: async (carId: number, quantity: number, lotId?: string): Promise<MaterialsResolveResult> =>
    d(await http.get("/recipes/resolve", { params: { car_model_id: carId, quantity, lot_id: lotId } })),

  // batch
  batchMaterials: async (batchId: string): Promise<BatchMaterials> =>
    d(await http.get(`/batches/${batchId}/materials`)),
};
