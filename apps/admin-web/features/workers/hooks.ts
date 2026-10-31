import type { WorkerUpdateInput } from "@rps/shared";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workerApi } from "./api";
import type { CreateWorkerInput } from "./types";

export function useWorkers() {
  return useQuery({ queryKey: ["workers"], queryFn: workerApi.list });
}

export function useCreateWorker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkerInput) => workerApi.create(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workers"] }),
  });
}

// Worker page (U1). "Now" changes with the floor → poll like the batch views.
export const useWorker = (id: string) =>
  useQuery({
    queryKey: ["worker", id],
    queryFn: () => workerApi.detail(id),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

export const useWorkerSummary = (id: string, from: string, to: string) =>
  useQuery({ queryKey: ["worker-summary", id, from, to], queryFn: () => workerApi.summary(id, from, to) });

export const useWorkerHistory = (id: string) =>
  useInfiniteQuery({
    queryKey: ["worker-history", id],
    queryFn: ({ pageParam }) => workerApi.history(id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor,
  });

export function useUpdateWorker(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkerUpdateInput) => workerApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["worker", id] });
      qc.invalidateQueries({ queryKey: ["workers"] });
    },
  });
}

export function useResetPin(id: string) {
  return useMutation({ mutationFn: (pin?: string) => workerApi.resetPin(id, pin) });
}
