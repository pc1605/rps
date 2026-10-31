/** RFC 4180-ish CSV: quote fields with commas, quotes or newlines. */
export function toCsv<T>(
  rows: T[],
  cols: { header: string; value: (r: T) => string | number | null | undefined }[],
) {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [
    cols.map((c) => esc(c.header)).join(","),
    ...rows.map((r) => cols.map((c) => esc(c.value(r))).join(",")),
  ].join("\n");
}

/** Hands the viewer a .csv built in the browser (no request). */
export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
