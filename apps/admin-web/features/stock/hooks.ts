import { useQuery } from "@tanstack/react-query";
import { stockApi } from "./api";

// Raw-material rolls moved to features/materials (C2); Stock is finished goods only.
export function useFinishedGoods() {
  return useQuery({ queryKey: ["stock-finished"], queryFn: stockApi.finished });
}
