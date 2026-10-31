import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { materialsApi } from "./api";

export const useLot = (id: string) =>
  useQuery({ queryKey: ["lot", id], queryFn: () => materialsApi.lot(id) });

export const useLotMovements = (lotId: string) =>
  useInfiniteQuery({
    queryKey: ["movements", { lotId }],
    queryFn: ({ pageParam }) => materialsApi.movements({ lot_id: lotId, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor,
  });
