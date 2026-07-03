import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
