import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { catalogApi } from "./api";
import type { CarItemInput } from "./types";

export const useCarItems = () => useQuery({ queryKey: ["car-models"], queryFn: catalogApi.items });
export const useBrands = () => useQuery({ queryKey: ["car-brands"], queryFn: catalogApi.brands });
export const useProductLines = () => useQuery({ queryKey: ["product-lines"], queryFn: catalogApi.lines });

export function useCreateBrand() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: catalogApi.createBrand,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["car-brands"] }),
  });
}
export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (i: CarItemInput) => catalogApi.createItem(i),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["car-models"] }),
  });
}
export function useUpdateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: number } & Partial<CarItemInput> & { is_active?: boolean }) =>
      catalogApi.updateItem(id, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["car-models"] }),
  });
}
