import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { unitApi } from "./api";

export const useUnit = (code: string) =>
  useQuery({
    queryKey: ["unit", code],
    queryFn: () => unitApi.journey(code),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

/** Owner/supervisor: reverse a mat's last stitch or pack scan. */
export function useUndoScan(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reason: string) => unitApi.undoScan(code, reason),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["unit", code] });
      qc.invalidateQueries({ queryKey: ["batch", res.batch_id] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["batch-stats"] });
    },
  });
}
