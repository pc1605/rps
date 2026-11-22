import { useEffect, useRef } from "react";

/**
 * A screen opened for one item of a cached list (e.g. from a notification tap) may arrive before the list
 * knows the item: the copy was read before the admin assigned it. Before saying "not found", read the list
 * again once. Returns true while that check is still running — show the loading view then.
 */
export function useConfirmMissing(q: {
  found: boolean;
  isPending: boolean;
  isFetching: boolean;
  refetch: () => Promise<unknown>;
}): boolean {
  const { found, isPending, isFetching, refetch } = q;
  const asked = useRef(false);
  const missing = !isPending && !found;

  useEffect(() => {
    if (missing && !asked.current) {
      asked.current = true;
      void refetch();
    }
  }, [missing, refetch]);

  return missing && (!asked.current || isFetching);
}
