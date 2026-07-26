"use client";

import { useFinishedGoods } from "../hooks";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const sizeStyle: Record<string, string> = {
  small: "text-cyan-600 dark:text-cyan-400",
  medium: "text-amber-600 dark:text-amber-400",
  large: "text-pink-600 dark:text-pink-400",
};

export function FinishedGoods() {
  const { data: stock, isLoading, error } = useFinishedGoods();

  if (isLoading)
    return (
      <p className="font-mono text-sm text-muted-foreground">
        Loading stockyard…
      </p>
    );
  if (error)
    return (
      <p className="font-mono text-sm text-destructive">
        Failed to load finished goods.
      </p>
    );
  if (!stock?.length)
    return (
      <Card className="p-12 text-center text-muted-foreground text-sm">
        Stockyard is empty — no packed mats yet.
      </Card>
    );

  const total = stock.reduce((sum, s) => sum + s.packed_count, 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{total} mats</span>{" "}
        ready in the stockyard.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {stock.map((s) => (
          <Card
            key={s.car_model_id}
            className="p-4 flex items-center justify-between"
          >
            <div>
              <div className="font-medium">
                {s.brand_name} {s.model_name}
              </div>
              <div
                className={cn(
                  "font-mono text-[10px] uppercase mt-0.5",
                  sizeStyle[s.size_class],
                )}
              >
                {s.size_class}
              </div>
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {s.packed_count}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
