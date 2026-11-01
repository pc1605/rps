"use client";

import { Layers } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useSpares } from "../hooks";

/** One line on Stock when there are spare mats from cancelled batches. */
export function SparesLink() {
  const { data } = useSpares();
  const total = (data ?? []).reduce((n, s) => n + s.stitched + s.unstitched, 0);
  if (total === 0) return null;
  return (
    <Card className="p-0">
      <Link
        href="/stock/spares"
        className="flex min-h-12 items-center justify-between gap-3 px-4 text-small hover:bg-accent"
      >
        <span className="inline-flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span>
            <span className="tabular font-medium">{total}</span> spare {total === 1 ? "mat" : "mats"} from
            cancelled batches
          </span>
        </span>
        <span className="text-muted-foreground">View →</span>
      </Link>
    </Card>
  );
}
