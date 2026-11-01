import { useQuery } from "@tanstack/react-query";
import { meApi } from "./api";

/** The worker's own output for the home "My work" card. */
export function useMySummary() {
  return useQuery({ queryKey: ["my-summary"], queryFn: meApi.summary, refetchInterval: 60_000 });
}
