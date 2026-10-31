"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type DateRange, presetRanges } from "./range-picker";

const DEFAULT = "Last 30 days";

/** The report date range as URL state (?from&to); defaults to the last 30 days. */
export function useReportRange(): [DateRange, (r: DateRange) => void] {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const presets = presetRanges();
  const fallback = presets.find((p) => p.label === DEFAULT) ??
    presets[0] ?? { label: DEFAULT, from: "", to: "" };
  const from = sp.get("from");
  const to = sp.get("to");
  const range: DateRange =
    from && to
      ? (presets.find((p) => p.from === from && p.to === to) ?? { label: "Custom", from, to })
      : fallback;
  const set = (r: DateRange) => {
    const next = new URLSearchParams(sp.toString());
    if (r.label === DEFAULT) {
      next.delete("from");
      next.delete("to");
    } else {
      next.set("from", r.from);
      next.set("to", r.to);
    }
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  };
  return [range, set];
}
