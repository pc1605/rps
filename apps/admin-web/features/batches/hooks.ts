import type { BatchEditInput, BatchListParams, HandOverInput, ShortAction, ShortReason } from "@rps/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { batchApi } from "./api";
import type { AssignmentInput, CreateBatchInput, Phase } from "./types";

// Live-ish data: everything the floor changes gets an interval.
const LIVE = { refetchInterval: 10_000, refetchOnWindowFocus: true } as const;
const LIVE_FAST = { refetchInterval: 5_000, refetchOnWindowFocus: true } as const;

/** A page of the batch list (U2: server-side filters, sort, paging). */
export const useBatchPage = (params: BatchListParams) =>
  useQuery({
    queryKey: ["batches", params],
    queryFn: () => batchApi.list(params),
    placeholderData: keepPreviousData,
    ...LIVE,
  });

export const useSearch = (q: string) =>
  useQuery({
    queryKey: ["search", q],
    queryFn: () => batchApi.search(q),
    enabled: q.trim().length >= 2,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

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

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBatchInput) => batchApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
}

/** Edit a batch before cutting (car, quantity, roll, notes). */
export function useEditBatch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BatchEditInput) => batchApi.edit(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch", id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batch-materials", id] });
    },
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
      qc.invalidateQueries({ queryKey: ["batch-stats"] });
      qc.invalidateQueries({ queryKey: ["stitcher-load"] });
    },
  });
}

/** Stitcher workload for the assign panel. */
export const useStitcherLoads = (enabled = true) =>
  useQuery({ queryKey: ["stitcher-load"], queryFn: batchApi.stitcherLoads, enabled, ...LIVE });

/** A stitcher's live stitching assignments (hand-over dialog). */
export const useOpenStitching = (workerId: string, enabled = true) =>
  useQuery({
    queryKey: ["stitcher-open", workerId],
    queryFn: () => batchApi.openStitching(workerId),
    enabled: enabled && !!workerId,
    ...LIVE,
  });

/** Move a stitcher's remaining mats to others (one or more batches, all or nothing). */
export function useHandOver() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: HandOverInput) => batchApi.handOver(input),
    onSuccess: (res) => {
      for (const r of res) qc.invalidateQueries({ queryKey: ["batch", r.batch_id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["stitcher-load"] });
      qc.invalidateQueries({ queryKey: ["stitcher-open"] });
      qc.invalidateQueries({ queryKey: ["worker"] });
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
    mutationFn: ({ action, reason, note }: { action: ShortAction; reason: ShortReason; note?: string }) =>
      batchApi.resolveShort(id, action, reason, note),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batch", id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}
