import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReworkDecision, ReworkEntry } from "@rps/shared";
import { type ListReworkParams, reworkApi } from "./api";

const LIVE = { refetchInterval: 10_000, refetchOnWindowFocus: true } as const;

export function useReworkQueue(params?: ListReworkParams) {
  return useQuery({
    queryKey: ["rework", params],
    queryFn: () => reworkApi.list(params),
    ...LIVE,
  });
}

export interface DecideReworkVariables {
  id: string;
  decision: ReworkDecision;
  note?: string;
  batchId?: string;
}

export function useDecideRework() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, decision, note }: DecideReworkVariables) => reworkApi.decide(id, decision, note),
    onSuccess: (data: ReworkEntry, variables) => {
      qc.invalidateQueries({ queryKey: ["rework"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batch-stats"] });
      const batchId = data?.batch_id ?? variables.batchId;
      if (batchId) {
        qc.invalidateQueries({ queryKey: ["batch", batchId] });
      }
    },
  });
}
