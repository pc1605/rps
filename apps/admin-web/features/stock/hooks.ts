import type { SpareWriteOffInput } from "@rps/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { live } from "@/lib/live";
import { stockApi } from "./api";

// Raw-material rolls moved to features/materials (C2); Stock is finished goods + spare mats.
export function useFinishedGoods() {
  return useQuery({ queryKey: ["stock-finished"], queryFn: stockApi.finished, ...live() });
}

/** Spare mats per car item; with a car id, only that item (New batch offer). */
export function useSpares(carModelId?: number, enabled = true) {
  return useQuery({
    queryKey: ["spares", carModelId ?? "all"],
    queryFn: () => stockApi.spares(carModelId),
    enabled,
    ...live(),
  });
}

export function useWriteOffSpares() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SpareWriteOffInput) => stockApi.writeOffSpares(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["spares"] }),
  });
}
