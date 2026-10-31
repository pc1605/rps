import type { MaterialLineInput } from "@rps/shared";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type LotFilter, type MovementFilter, materialsApi } from "./api";

// Stock changes with every cut → light polling on the stock views.
const LIVE = { refetchInterval: 15_000, refetchOnWindowFocus: true } as const;

export const useMaterialTypes = () =>
  useQuery({ queryKey: ["material-types"], queryFn: materialsApi.types, ...LIVE });
export const useVariants = (typeId?: number) =>
  useQuery({
    queryKey: ["material-variants", typeId],
    queryFn: () => materialsApi.variants(typeId as number),
    enabled: !!typeId,
  });
export const useLots = (f: LotFilter) =>
  useQuery({
    queryKey: ["lots", f],
    queryFn: () => materialsApi.lots(f),
    placeholderData: keepPreviousData,
    ...LIVE,
  });
export const useLot = (id: string) =>
  useQuery({ queryKey: ["lot", id], queryFn: () => materialsApi.lot(id), ...LIVE });

export const useMovements = (f: Omit<MovementFilter, "cursor">) =>
  useInfiniteQuery({
    queryKey: ["movements", f],
    queryFn: ({ pageParam }) => materialsApi.movements({ ...f, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor,
  });
export const useLotMovements = (lotId: string) => useMovements({ lot_id: lotId });

export const useGroups = () => useQuery({ queryKey: ["consumption-groups"], queryFn: materialsApi.groups });
export const useRecipeGrid = (lineId?: number) =>
  useQuery({
    queryKey: ["recipe-grid", lineId],
    queryFn: () => materialsApi.recipeGrid(lineId as number),
    enabled: !!lineId,
  });
export const useOverrides = (carId: number) =>
  useQuery({
    queryKey: ["overrides", carId],
    queryFn: () => materialsApi.overrides(carId),
    enabled: carId > 0,
  });
export const useResolve = (carId: number, quantity: number, lotId?: string) =>
  useQuery({
    queryKey: ["resolve", carId, quantity, lotId],
    queryFn: () => materialsApi.resolve(carId, quantity, lotId),
    enabled: carId > 0 && quantity > 0,
    placeholderData: keepPreviousData,
  });
export const useBatchMaterials = (batchId: string) =>
  useQuery({
    queryKey: ["batch-materials", batchId],
    queryFn: () => materialsApi.batchMaterials(batchId),
    refetchInterval: 10_000,
  });

/** Anything that moves stock or changes catalogue data refreshes every materials view. */
function useStockMutation<TVars, TRes>(fn: (v: TVars) => Promise<TRes>, keys: string[][] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      for (const k of [
        ["lots"],
        ["lot"],
        ["movements"],
        ["material-types"],
        ["material-variants"],
        ["batch-stats"],
        ...keys,
      ])
        qc.invalidateQueries({ queryKey: k });
    },
  });
}

export const useCreateType = () => useStockMutation(materialsApi.createType);
export const useUpdateType = () =>
  useStockMutation(({ id, ...i }: { id: number } & Parameters<typeof materialsApi.updateType>[1]) =>
    materialsApi.updateType(id, i),
  );
export const useDeleteType = () => useStockMutation(materialsApi.deleteType);
export const useCreateVariant = () =>
  useStockMutation(
    ({ typeId, ...i }: { typeId: number } & Parameters<typeof materialsApi.createVariant>[1]) =>
      materialsApi.createVariant(typeId, i),
  );
export const useUpdateVariant = () =>
  useStockMutation(({ id, ...i }: { id: number } & Parameters<typeof materialsApi.updateVariant>[1]) =>
    materialsApi.updateVariant(id, i),
  );
export const useReceive = () => useStockMutation(materialsApi.receive);
export const useAdjust = () =>
  useStockMutation(({ id, ...i }: { id: string } & Parameters<typeof materialsApi.adjust>[1]) =>
    materialsApi.adjust(id, i),
  );
export const useWaste = () =>
  useStockMutation(({ id, ...i }: { id: string } & Parameters<typeof materialsApi.waste>[1]) =>
    materialsApi.waste(id, i),
  );
export const useReturn = () =>
  useStockMutation(({ id, ...i }: { id: string } & Parameters<typeof materialsApi.return>[1]) =>
    materialsApi.return(id, i),
  );
export const usePatchLot = () =>
  useStockMutation(({ id, ...i }: { id: string } & Parameters<typeof materialsApi.patchLot>[1]) =>
    materialsApi.patchLot(id, i),
  );
export const useCreateGroup = () =>
  useStockMutation(materialsApi.createGroup, [["consumption-groups"], ["recipe-grid"], ["car-models"]]);
export const useUpdateGroup = () =>
  useStockMutation(
    ({ id, ...i }: { id: number } & Parameters<typeof materialsApi.updateGroup>[1]) =>
      materialsApi.updateGroup(id, i),
    [["consumption-groups"], ["recipe-grid"], ["car-models"], ["car-overview"]],
  );
export const useDeleteGroup = () =>
  useStockMutation(materialsApi.deleteGroup, [["consumption-groups"], ["recipe-grid"]]);
export const usePutRecipeLines = () =>
  useStockMutation(
    ({ lineId, groupId, lines }: { lineId: number; groupId: number; lines: MaterialLineInput[] }) =>
      materialsApi.putRecipeLines(lineId, groupId, lines),
    [["recipe-grid"], ["resolve"]],
  );
export const usePutOverrides = () =>
  useStockMutation(
    ({ carId, lines }: { carId: number; lines: MaterialLineInput[] }) =>
      materialsApi.putOverrides(carId, lines),
    [["overrides"], ["resolve"]],
  );
