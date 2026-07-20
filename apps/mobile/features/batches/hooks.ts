import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "./api";

export function useMyBatches() {
  return useQuery({
    queryKey: ["my-batches"],
    queryFn: batchApi.myBatches,
    refetchInterval: 15_000,
  });
}

export function useStartBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => batchApi.start(id),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-batches"] }),
  });
}

export function useCompleteBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; qty: number; notes?: string }) =>
      batchApi.complete(v.id, v.qty, v.notes),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-batches"] }),
  });
}
