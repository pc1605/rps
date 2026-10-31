"use client";

import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCarItems, useProductLines } from "@/features/catalog/hooks";
import { cn } from "@/lib/utils";
import type { UrlState } from "../use-list-params";

const ALL = "all";

function Toggle({
  on,
  onChange,
  children,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={on}
      onClick={() => onChange(!on)}
      className={cn(on && "border-foreground/40 bg-accent text-foreground")}
    >
      {children}
    </Button>
  );
}

export function BatchFilters({
  state,
  set,
  filtered,
}: {
  state: UrlState;
  set: (p: Partial<UrlState>) => void;
  filtered: boolean;
}) {
  const { data: cars } = useCarItems();
  const { data: lines } = useProductLines();
  const [q, setQ] = useState(state.q ?? "");

  // Debounce typing into the URL; keep the box in sync when the URL changes (back button, clear).
  useEffect(() => setQ(state.q ?? ""), [state.q]);
  useEffect(() => {
    if ((state.q ?? "") === q) return;
    const t = setTimeout(() => set({ q: q.trim() || undefined }), 300);
    return () => clearTimeout(t);
  }, [q, state.q, set]);

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="relative min-w-56 flex-1 sm:max-w-xs">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Batch code, car or barcode…"
          className="pl-8"
          aria-label="Search batches"
        />
      </div>
      <Select value={state.car ?? ALL} onValueChange={(v) => set({ car: v === ALL ? undefined : v })}>
        <SelectTrigger className="w-48" aria-label="Filter by item">
          <SelectValue placeholder="Any item" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any item</SelectItem>
          {(cars ?? []).map((c) => (
            <SelectItem key={c.id} value={String(c.id)}>
              {c.brand_name} {c.name}
              {c.line_name ? ` · ${c.line_name}` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={state.line ?? ALL} onValueChange={(v) => set({ line: v === ALL ? undefined : v })}>
        <SelectTrigger className="w-40" aria-label="Filter by product line">
          <SelectValue placeholder="Any line" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any line</SelectItem>
          {(lines ?? []).map((l) => (
            <SelectItem key={l.id} value={String(l.id)}>
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Label htmlFor="batch-from" className="sr-only">
          Created from
        </Label>
        <Input
          id="batch-from"
          type="date"
          value={state.from ?? ""}
          onChange={(e) => set({ from: e.target.value || undefined })}
          className="w-38"
        />
        <span className="text-muted-foreground" aria-hidden>
          →
        </span>
        <Label htmlFor="batch-to" className="sr-only">
          Created to
        </Label>
        <Input
          id="batch-to"
          type="date"
          value={state.to ?? ""}
          onChange={(e) => set({ to: e.target.value || undefined })}
          className="w-38"
        />
      </div>
      <Toggle on={!!state.rework} onChange={(v) => set({ rework: v ? "1" : undefined })}>
        Open rework
      </Toggle>
      <Toggle on={!!state.short} onChange={(v) => set({ short: v ? "1" : undefined })}>
        Short cut
      </Toggle>
      {filtered && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            set({
              q: undefined,
              car: undefined,
              line: undefined,
              from: undefined,
              to: undefined,
              rework: undefined,
              short: undefined,
            })
          }
        >
          <X className="h-3.5 w-3.5" aria-hidden /> Clear
        </Button>
      )}
    </div>
  );
}
