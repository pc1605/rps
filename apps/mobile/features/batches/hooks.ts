import { useQuery } from "@tanstack/react-query";
import { batchApi } from "./api";

export function useMyBatches() {
  return useQuery({
    queryKey: ["my-batches"],
    queryFn: batchApi.myBatches,
    refetchInterval: 15_000, // floor state changes; keep it fresh
  });
}
