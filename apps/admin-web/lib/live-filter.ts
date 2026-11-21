/**
 * Whether a live note ("something changed") re-reads this query: those marked live — except a paged
 * list with more than its first page open. TanStack re-reads every open page, one after another, and
 * notes come with every scan on the floor: the admin reading back through a worker's history would
 * fire a burst of requests per scan. Its first page stays live; a long scroll-back is read on return.
 */
export function reReadOnNote(query: { meta?: Record<string, unknown>; state: { data: unknown } }): boolean {
  if (query.meta?.live !== true) return false;
  const pages = (query.state.data as { pages?: unknown } | undefined)?.pages;
  return !(Array.isArray(pages) && pages.length > 1);
}
