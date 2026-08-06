import { useQuery } from "@tanstack/react-query";
import { reportApi } from "./api";

export function useWorkerReport(from?: string, to?: string) {
  return useQuery({
    queryKey: ["report-workers", from, to],
    queryFn: () => reportApi.workers(from, to),
  });
}
