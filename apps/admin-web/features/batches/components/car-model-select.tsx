"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { sizeLabel } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { useCarModels } from "../hooks";
import type { CarModel } from "../types";

interface Props {
  id?: string;
  value: number | "";
  onChange: (id: number) => void;
}

const size = (s: string) => sizeLabel[s] ?? s;

function itemLabel(m: CarModel) {
  return `${m.brand_name} ${m.name} ${m.size_class} ${size(m.size_class)} ${m.line_name ?? ""}`;
}

export function CarModelSelect({ id, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data: models } = useCarModels();

  // Group by brand; within a brand keep a car's lines together
  const grouped = useMemo(() => {
    const sorted = (models ?? [])
      .filter((m) => m.is_active)
      .sort(
        (a, b) =>
          a.brand_name.localeCompare(b.brand_name) ||
          a.name.localeCompare(b.name) ||
          a.size_class.localeCompare(b.size_class) ||
          (a.line_code ?? "").localeCompare(b.line_code ?? ""),
      );
    const map = new Map<string, CarModel[]>();
    for (const m of sorted) {
      const list = map.get(m.brand_name);
      if (list) list.push(m);
      else map.set(m.brand_name, [m]);
    }
    return Array.from(map.entries());
  }, [models]);

  const selected = models?.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="min-w-0 truncate">
              {selected.brand_name} {selected.name}
              <span className="ml-2 text-caption text-muted-foreground">
                {size(selected.size_class)}
                {selected.line_name ? ` · ${selected.line_name}` : ""}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select item…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command
          filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}
        >
          <CommandInput placeholder="Search brand, model, line or barcode…" />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            {grouped.map(([brand, brandModels]) => (
              <CommandGroup key={brand} heading={brand}>
                {brandModels.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${itemLabel(m)} ${m.barcode ?? ""} #${m.id}`} // unique + searchable by barcode
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")}
                      aria-hidden
                    />
                    <span className="flex-1">{m.name}</span>
                    <span className="mr-3 text-caption text-muted-foreground">{m.line_name ?? "—"}</span>
                    <span className="tabular w-4 text-center text-caption text-muted-foreground">
                      {size(m.size_class)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
