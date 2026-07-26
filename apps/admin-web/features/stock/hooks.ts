import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { stockApi } from "./api";
import type { CreateRollInput, UpdateRollInput } from "./types";

export function useRollsStock() {
  return useQuery({ queryKey: ["stock-rolls"], queryFn: stockApi.list });
}

export function useCreateRoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRollInput) => stockApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-rolls"] });
      qc.invalidateQueries({ queryKey: ["rolls"] }); // batch-create dropdown too
    },
  });
}

export function useUpdateRoll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; input: UpdateRollInput }) =>
      stockApi.update(v.id, v.input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-rolls"] });
      qc.invalidateQueries({ queryKey: ["rolls"] });
    },
  });
}

export function useFinishedGoods() {
  return useQuery({ queryKey: ["stock-finished"], queryFn: stockApi.finished });
}
