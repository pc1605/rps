"use client";

import { useState, useMemo } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCarModels } from "../hooks";
import type { CarModel } from "../types";

const sizeBadge: Record<string, string> = {
  small: "text-cyan-600 dark:text-cyan-400",
  medium: "text-amber-600 dark:text-amber-400",
  large: "text-pink-600 dark:text-pink-400",
};

interface Props {
  value: number | "";
  onChange: (id: number) => void;
}

function itemLabel(m: CarModel) {
  return `${m.brand_name} ${m.name} · ${m.size_class} · ${m.line_name ?? "no line"}`;
}

export function CarModelSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data: models } = useCarModels();

  // Group by brand; within a brand keep a car's lines together
   const grouped = useMemo(() => {
    const sorted = (models ?? [])
      .filter((m) => m.is_active)                                   // ← hide retired items
      .sort(
        (a, b) =>
          a.brand_name.localeCompare(b.brand_name) ||
          a.name.localeCompare(b.name) ||
          a.size_class.localeCompare(b.size_class) ||
          (a.line_code ?? "").localeCompare(b.line_code ?? ""),
      );
    const map = new Map<string, CarModel[]>();
    sorted.forEach((m) =>
      map.set(m.brand_name, [...(map.get(m.brand_name) ?? []), m]),
    );
    return Array.from(map.entries());
  }, [models]);

  const selected = models?.find((m) => m.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
        >
          {selected ? (
            <span className="truncate">
              {selected.brand_name} {selected.name}
              <span
                className={cn(
                  "ml-2 font-mono text-[10px] uppercase",
                  sizeBadge[selected.size_class],
                )}
              >
                {selected.size_class}
              </span>
              {selected.line_name && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {selected.line_name}
                </span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">Select item…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) =>
            itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
          }
        >
          <CommandInput placeholder="Search brand, model, or line…" />
          <CommandList>
            <CommandEmpty>No item found.</CommandEmpty>
            {grouped.map(([brand, brandModels]) => (
              <CommandGroup key={brand} heading={brand}>
                {brandModels.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${itemLabel(m)} ${m.barcode ?? ""} #${m.id}`} // unique + searchable by barcode too
                    onSelect={() => {
                      onChange(m.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === m.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <span className="flex-1">{m.name}</span>
                    <span className="mr-3 text-xs text-muted-foreground">
                      {m.line_name ?? "—"}
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase",
                        sizeBadge[m.size_class],
                      )}
                    >
                      {m.size_class}
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
