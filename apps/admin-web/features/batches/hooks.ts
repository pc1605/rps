import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "./api";
import type { CreateBatchInput } from "./types";

export function useBatches() {
  return useQuery({ queryKey: ["batches"], queryFn: batchApi.list });
}

export function useBatch(id: string) {
  return useQuery({
    queryKey: ["batch", id],
    queryFn: () => batchApi.get(id),
    enabled: !!id,
  });
}

export function useCarModels() {
  return useQuery({
    queryKey: ["car-models"],
    queryFn: batchApi.carModels,
    staleTime: 5 * 60_000,
  });
}

export function useRolls() {
  return useQuery({
    queryKey: ["rolls"],
    queryFn: batchApi.rolls,
    staleTime: 60_000,
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => batchApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
}

export function useBatchStats() {
  return useQuery({
    queryKey: ["batch-stats"],
    queryFn: batchApi.stats,
    refetchInterval: 5000, // polling — feels live
  });
}
