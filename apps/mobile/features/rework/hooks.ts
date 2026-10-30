import type { ReworkReason } from "@rps/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/store";
import { reworkApi } from "./api";

export function useMyRework() {
  const { worker } = useAuth();
  const isStitcher = worker?.station === "stitcher";

  return useQuery({
    queryKey: ["my-rework"],
    queryFn: reworkApi.listMyRework,
    enabled: isStitcher,
    refetchInterval: 15_000,
  });
}

export function useFlagRework() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (vars: { unitCode: string; reasons: ReworkReason[]; note?: string; photoUris: string[] }) =>
      reworkApi.flagRework(vars.unitCode, vars.reasons, vars.note, vars.photoUris),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-batches"] });
    },
  });
}
