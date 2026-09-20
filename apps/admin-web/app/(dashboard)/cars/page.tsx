"use client";

import { useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useCarItems, useUpdateItem } from "@/features/catalog/hooks";
import { ItemDialog } from "@/features/catalog/components/item-dialog";

export default function CarsPage() {
  const { data: items, isPending } = useCarItems();
  const update = useUpdateItem();
  const [q, setQ] = useState("");

  const visible = (items ?? []).filter((i) =>
    `${i.brand_name} ${i.name} ${i.size_class} ${i.line_name ?? ""} ${i.barcode ?? ""}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cars</h1>
          <p className="text-muted-foreground mt-1">Items you make: car · size · product line · barcode.</p>
        </div>
        <ItemDialog />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search brand, model, line, barcode…" className="pl-8" />
      </div>

      {isPending ? (
        <p className="font-mono text-sm text-muted-foreground">Loading…</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {["Brand", "Model", "Size", "Line", "Pieces", "Barcode", "Active", ""].map((h) => (
                  <TableHead key={h} className="h-11 px-4 font-mono text-[10px] uppercase tracking-wider">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((i) => (
                <TableRow key={i.id} className={cn(!i.is_active && "opacity-50")}>
                  <TableCell className="px-4">{i.brand_name}</TableCell>
                  <TableCell className="px-4 font-medium">{i.name}</TableCell>
                  <TableCell className="px-4"><Badge variant="outline" className="font-mono text-[10px] uppercase">{i.size_class}</Badge></TableCell>
                  <TableCell className="px-4 text-sm text-muted-foreground">{i.line_name ?? "—"}</TableCell>
                  <TableCell className="px-4 font-mono tabular-nums">{i.pieces_per_set}</TableCell>
                  <TableCell className="px-4 font-mono text-xs">{i.barcode ?? "—"}</TableCell>
                  <TableCell className="px-4">
                    <Switch checked={i.is_active} onCheckedChange={(v) => update.mutate({ id: i.id, is_active: v })} />
                  </TableCell>
                  <TableCell className="px-4 text-right">
                    <ItemDialog item={i} trigger={<Button variant="ghost" size="icon"><Pencil className="h-4 w-4" /></Button>} />
                  </TableCell>
                </TableRow>
              ))}
              {!visible.length && (
                <TableRow><TableCell colSpan={8} className="p-10 text-center text-muted-foreground text-sm">No items match.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}