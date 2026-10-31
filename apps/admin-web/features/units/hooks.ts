import { useQuery } from "@tanstack/react-query";
import { unitApi } from "./api";

export const useUnit = (code: string) =>
  useQuery({
    queryKey: ["unit", code],
    queryFn: () => unitApi.journey(code),
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });
