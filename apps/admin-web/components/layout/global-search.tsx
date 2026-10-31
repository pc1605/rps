"use client";

import type { SearchHit, SearchKind } from "@rps/shared";
import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Car, Package, ScanLine, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { batchApi } from "@/features/batches/api";
import { useSearch } from "@/features/batches/hooks";
import { cn } from "@/lib/utils";

const href = (h: SearchHit) =>
  ({
    batch: `/batches/${h.id}`,
    unit: `/units/${encodeURIComponent(h.id)}`,
    car: `/cars/${h.id}`,
    worker: `/workers/${h.id}`,
    lot: `/stock/lots/${h.id}`,
  })[h.kind];

const groups: { kind: SearchKind; label: string; icon: React.ElementType }[] = [
  { kind: "batch", label: "Batches", icon: Package },
  { kind: "unit", label: "Mats", icon: ScanLine },
  { kind: "car", label: "Cars", icon: Car },
  { kind: "worker", label: "Workers", icon: User },
  { kind: "lot", label: "Lots", icon: Boxes },
];

/** Header search (U2): batch / mat / lot code, barcode, worker, car. A USB scanner's "code + Enter" opens the exact match. */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [q, setQ] = useState(""); // debounced
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { data, isFetching } = useSearch(q);

  useEffect(() => {
    const t = setTimeout(() => setQ(text.trim()), 200);
    return () => clearTimeout(t);
  }, [text]);

  const go = (h: SearchHit) => {
    setOpen(false);
    setText("");
    setQ("");
    inputRef.current?.blur();
    router.push(href(h));
  };

  // Enter before the debounced results arrive (scanner, fast typing): search now, open exact / first hit.
  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (e.key !== "Enter") return;
    const now = text.trim();
    if (now.length < 2 || (data && data.q === now && data.hits.length > 0)) return; // cmdk selects the highlighted item
    e.preventDefault();
    const r = await qc.fetchQuery({
      queryKey: ["search", now],
      queryFn: () => batchApi.search(now),
      staleTime: 10_000,
    });
    const hit = r.exact ?? r.hits[0];
    if (hit) go(hit);
  };

  const hits = data && data.q === q ? data.hits : [];
  const exact = data && data.q === q ? data.exact : undefined;
  const show = open && q.length >= 2;

  return (
    <Command shouldFilter={false} className={cn("relative overflow-visible bg-transparent", className)}>
      <CommandInput
        ref={inputRef}
        value={text}
        onValueChange={(v) => {
          setText(v);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Search or scan a code…"
        aria-label="Search batches, mats, cars, workers, lots"
      />
      {show && (
        <CommandList className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 rounded-lg border bg-popover p-1 shadow-lg">
          {!isFetching && <CommandEmpty>No matches for “{q}”.</CommandEmpty>}
          {exact && (
            <CommandGroup heading="Exact match">
              <CommandItem
                value={`exact:${exact.kind}:${exact.id}`}
                onSelect={() => go(exact)}
                onMouseDown={(e) => e.preventDefault()}
              >
                <span className="font-mono">{exact.label}</span>
                <span className="ml-auto truncate text-caption text-muted-foreground">{exact.sub}</span>
              </CommandItem>
            </CommandGroup>
          )}
          {groups.map(({ kind, label, icon: Icon }) => {
            const rows = hits.filter(
              (h) => h.kind === kind && !(exact && h.kind === exact.kind && h.id === exact.id),
            );
            if (!rows.length) return null;
            return (
              <CommandGroup key={kind} heading={label}>
                {rows.map((h) => (
                  <CommandItem
                    key={`${h.kind}:${h.id}`}
                    value={`${h.kind}:${h.id}`}
                    onSelect={() => go(h)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                    <span className={cn(kind !== "worker" && kind !== "car" && "font-mono")}>{h.label}</span>
                    <span className="ml-auto truncate text-caption text-muted-foreground">{h.sub}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
        </CommandList>
      )}
    </Command>
  );
}
