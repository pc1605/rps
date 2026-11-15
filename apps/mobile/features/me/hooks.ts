import { useQuery } from "@tanstack/react-query";
import { live } from "../../lib/live";
import { meApi } from "./api";

/** The worker's own output for the home "My work" card. */
export function useMySummary() {
  return useQuery({ queryKey: ["my-summary"], queryFn: meApi.summary, ...live(60_000) });
}

/**
 * One month of the worker's own counts (work history screen). `null` = the current month: the server
 * decides which month that is, and it refetches every minute like the card. A past month doesn't
 * change (except an admin undo), so it is fetched once and kept for the session.
 */
export function useMyHistory(month: string | null) {
  return useQuery({
    queryKey: ["my-history", month ?? "current"],
    queryFn: () => meApi.history(month ?? undefined),
    ...(month ? { staleTime: Infinity, gcTime: Infinity } : live(60_000)),
  });
}
