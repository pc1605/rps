"use client";

import { PageHeader } from "@/components/rps/section";
import { RangePicker } from "./range-picker";
import { ReportsNav } from "./reports-nav";
import { useReportRange } from "./use-range";

/** Page header + tabs + date range shared by every report tab. Returns the range for the tab's queries. */
export function useReportChrome(description: string, actions?: React.ReactNode) {
  const [range, setRange] = useReportRange();
  const chrome = (
    <>
      <PageHeader title="Reports" description={description} actions={actions} />
      <ReportsNav />
      <RangePicker value={range} onChange={setRange} />
    </>
  );
  return { range, chrome };
}
