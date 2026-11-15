import type { StuckHours } from "@rps/shared";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { live } from "@/lib/live";
import { reportApi } from "./api";

export const useOverview = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["report-overview", from, to],
    queryFn: () => reportApi.overview(from, to),
    placeholderData: keepPreviousData,
    ...live(),
  });

export const useStuck = () =>
  useQuery({ queryKey: ["report-stuck"], queryFn: reportApi.stuck, ...live(60_000) });

export const useWorkerOutput = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["report-worker-output", from, to],
    queryFn: () => reportApi.workerOutput(from, to),
    placeholderData: keepPreviousData,
    ...live(),
  });

export const useQuality = (from?: string, to?: string) =>
  useQuery({
    queryKey: ["report-quality", from, to],
    queryFn: () => reportApi.quality(from, to),
    placeholderData: keepPreviousData,
    ...live(),
  });

export const useSettings = () => useQuery({ queryKey: ["settings"], queryFn: reportApi.settings });

export function usePutStuckHours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (h: StuckHours) => reportApi.putStuckHours(h),
    onSuccess: () => {
      for (const k of ["settings", "report-overview", "report-stuck"])
        qc.invalidateQueries({ queryKey: [k] });
    },
  });
}
