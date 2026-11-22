import type { GiveBackReason } from "@rps/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { live } from "../../lib/live";
import { batchApi } from "./api";

export function useMyBatches() {
  return useQuery({
    queryKey: ["my-batches"],
    queryFn: batchApi.myBatches,
    ...live(15_000),
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
    mutationFn: (v: { id: string; qty: number; notes?: string }) => batchApi.complete(v.id, v.qty, v.notes),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-batches"] }),
  });
}

export function useReleaseBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason, note }: { id: string; reason: GiveBackReason; note?: string }) =>
      batchApi.release(id, reason, note),
    onSettled: () => qc.invalidateQueries({ queryKey: ["my-batches"] }),
  });
}

export function useScanUnit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (unitCode: string) => batchApi.scanUnit(unitCode),
    onSuccess: (res) => {
      if (res.phase_completed || res.batch_completed) qc.invalidateQueries({ queryKey: ["my-batches"] });
    },
  });
}
