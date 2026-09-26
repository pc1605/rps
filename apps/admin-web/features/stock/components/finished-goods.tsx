"use client";

import { PackageCheck } from "lucide-react";
import { EmptyState } from "@/components/rps/empty-state";
import { SectionTitle } from "@/components/rps/section";
import { Stat } from "@/components/rps/stat";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { sizeLabel } from "@/lib/tokens";
import { useFinishedGoods } from "../hooks";

export function FinishedGoods() {
  const { data: stock, isPending, isError } = useFinishedGoods();

  if (isPending)
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );

  if (isError)
    return (
      <EmptyState title="Couldn't load finished goods" body="Check the backend is running, then reload." />
    );

  if (!stock?.length)
    return (
      <EmptyState
        icon={PackageCheck}
        title="Stockyard is empty"
        body="Mats land here automatically when the packer scans the last one in a batch."
      />
    );

  const total = stock.reduce((sum, s) => sum + s.packed_count, 0);

  return (
    <div className="space-y-4">
      <SectionTitle
        aside={
          <span>
            <span className="tabular font-medium text-foreground">{total}</span> mats ready
          </span>
        }
      >
        In the stockyard
      </SectionTitle>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {stock.map((s) => (
          <li key={s.car_model_id}>
            <Card className="flex items-center justify-between gap-4 p-4">
              <div className="min-w-0">
                <div className="truncate font-medium">
                  {s.brand_name} {s.model_name}
                </div>
                <div className="text-caption text-muted-foreground">
                  {sizeLabel[s.size_class] ?? s.size_class}
                  {s.line_name ? ` · ${s.line_name}` : ""}
                </div>
                {s.barcode && <div className="font-mono text-caption text-muted-foreground">{s.barcode}</div>}
              </div>
              <Stat size="sm" value={s.packed_count} className="shrink-0 items-end" />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}
