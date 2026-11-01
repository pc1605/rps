"use client";

import type { BatchListParams, BatchListView, BatchSort } from "@rps/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

// URL is the single source of truth for the batch list (U2): shareable, back-button safe.
// `phase` keeps its old name (sidebar tabs, dashboard pipeline links); the API calls it `view`.
export const PAGE_SIZE = 50;
const VIEWS: BatchListView[] = ["cutting", "ready", "stitching", "packing", "completed"];
const SORTS: BatchSort[] = ["created", "code", "quantity", "phase", "car", "waiting"];

export type UrlState = {
  phase?: BatchListView;
  q?: string;
  car?: string;
  line?: string;
  from?: string;
  to?: string;
  rework?: "1";
  short?: "1";
  sort?: BatchSort;
  order?: "asc" | "desc";
  page?: string;
};

export function useListParams() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo<UrlState>(() => {
    const get = (k: string) => sp.get(k) ?? undefined;
    const phase = get("phase") as BatchListView | undefined;
    const sort = get("sort") as BatchSort | undefined;
    const order = get("order");
    return {
      phase: phase && VIEWS.includes(phase) ? phase : undefined,
      q: get("q"),
      car: get("car"),
      line: get("line"),
      from: get("from"),
      to: get("to"),
      rework: get("rework") === "1" ? "1" : undefined,
      short: get("short") === "1" ? "1" : undefined,
      sort: sort && SORTS.includes(sort) ? sort : undefined,
      order: order === "asc" || order === "desc" ? order : undefined,
      page: get("page"),
    };
  }, [sp]);

  const params = useMemo<BatchListParams>(
    () => ({
      view: state.phase,
      q: state.q || undefined,
      car_model_id: state.car ? Number(state.car) : undefined,
      product_line_id: state.line ? Number(state.line) : undefined,
      from: state.from,
      to: state.to,
      has_rework: state.rework ? true : undefined,
      short: state.short ? true : undefined,
      // Ready to stitch opens longest-waiting first.
      sort: state.sort ?? (state.phase === "ready" ? "waiting" : undefined),
      order: state.order ?? (!state.sort && state.phase === "ready" ? "asc" : undefined),
      page: Math.max(1, Number(state.page) || 1),
      limit: PAGE_SIZE,
    }),
    [state],
  );

  /** Merge a patch into the URL. Any change other than `page` resets to page 1. */
  const set = useCallback(
    (patch: Partial<UrlState>) => {
      const next = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (!("page" in patch)) next.delete("page");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [sp, router, pathname],
  );

  const filtered = !!(
    state.q ||
    state.car ||
    state.line ||
    state.from ||
    state.to ||
    state.rework ||
    state.short
  );
  return { state, params, set, filtered };
}
