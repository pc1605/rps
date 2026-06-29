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

export function CarModelSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const { data: models } = useCarModels();

  // Group models by brand for display
  const grouped = useMemo(() => {
    const map = new Map<string, CarModel[]>();
    (models ?? []).forEach((m) => {
      const list = map.get(m.brand_name) ?? [];
      list.push(m);
      map.set(m.brand_name, list);
    });
    return Array.from(map.entries()); // [ [brand, models[]], ... ]
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
            <span>
              {selected.brand_name} {selected.name}
              <span
                className={cn(
                  "ml-2 font-mono text-[10px] uppercase",
                  sizeBadge[selected.size_class],
                )}
              >
                {selected.size_class}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select car model…</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] p-0"
        align="start"
      >
        <Command
          filter={(itemValue, search) => {
            // itemValue is the searchable string we set on each CommandItem
            return itemValue.toLowerCase().includes(search.toLowerCase())
              ? 1
              : 0;
          }}
        >
          <CommandInput placeholder="Search brand or model…" />
          <CommandList>
            <CommandEmpty>No model found.</CommandEmpty>
            {grouped.map(([brand, brandModels]) => (
              <CommandGroup key={brand} heading={brand}>
                {brandModels.map((m) => (
                  <CommandItem
                    key={m.id}
                    // value used by the filter — include brand + model + size so all are searchable
                    value={`${m.brand_name} ${m.name} ${m.size_class}`}
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
