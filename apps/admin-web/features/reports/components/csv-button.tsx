"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadCsv, toCsv } from "../lib/csv";

export function CsvButton<T>({
  filename,
  rows,
  cols,
}: {
  filename: string;
  rows: T[];
  cols: { header: string; value: (r: T) => string | number | null | undefined }[];
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={rows.length === 0}
      onClick={() => downloadCsv(filename, toCsv(rows, cols))}
    >
      <Download className="h-3.5 w-3.5" aria-hidden /> CSV
    </Button>
  );
}
