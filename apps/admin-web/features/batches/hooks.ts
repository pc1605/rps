import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "./api";
import type { AssignmentInput, CreateBatchInput, Phase } from "./types";

// Live-ish data: everything the floor changes gets an interval.
const LIVE = { refetchInterval: 10_000, refetchOnWindowFocus: true } as const;
const LIVE_FAST = { refetchInterval: 5_000, refetchOnWindowFocus: true } as const;

export const useBatches = () => useQuery({ queryKey: ["batches"], queryFn: batchApi.list, ...LIVE });

export const useBatch = (id: string) =>
  useQuery({ queryKey: ["batch", id], queryFn: () => batchApi.get(id), enabled: !!id, ...LIVE });

export const useBatchStats = () =>
  useQuery({ queryKey: ["batch-stats"], queryFn: batchApi.stats, ...LIVE_FAST });

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

export function useSetAssignments(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phase, assignments }: { phase: Phase; assignments: AssignmentInput[] }) =>
      batchApi.setAssignments(id, phase, assignments),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch", id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useMarkStickersPrinted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => batchApi.markStickersPrinted(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
}

export function useResolveShort(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ action, reason }: { action: "split" | "reduce" | "recut"; reason?: string }) =>
      batchApi.resolveShort(id, action, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch", id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}
