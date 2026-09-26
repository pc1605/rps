"use client";

import { Plus, Wand2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBrands, useCreateBrand, useCreateItem, useProductLines, useUpdateItem } from "../hooks";
import type { CarItem } from "../types";

export function ItemDialog({ item, trigger }: { item?: CarItem; trigger?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4" /> Add item
          </Button>
        )}
      </DialogTrigger>
      {open && <ItemForm item={item} onDone={() => setOpen(false)} />}
    </Dialog>
  );
}

function ItemForm({ item, onDone }: { item?: CarItem; onDone: () => void }) {
  const { data: brands } = useBrands();
  const { data: lines } = useProductLines();
  const createBrand = useCreateBrand();
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();

  const [brandId, setBrandId] = useState<string>(
    item ? String(brands?.find((b) => b.name === item.brand_name)?.id ?? "") : "",
  );
  const [newBrand, setNewBrand] = useState("");
  const [name, setName] = useState(item?.name ?? "");
  const [size, setSize] = useState(item?.size_class ?? "small");
  const [pieces, setPieces] = useState(String(item?.pieces_per_set ?? 4));
  const [lineId, setLineId] = useState<string>(
    item ? String(lines?.find((l) => l.code === item.line_code)?.id ?? "") : "",
  );
  const [barcode, setBarcode] = useState(item?.barcode ?? "");

  const busy = createBrand.isPending || createItem.isPending || updateItem.isPending;
  const canSave = name.trim() && (brandId || newBrand.trim()) && lineId;

  const save = async () => {
    try {
      let bid = Number(brandId);
      if (!brandId && newBrand.trim()) {
        const b = await createBrand.mutateAsync(newBrand.trim());
        bid = b.id;
      }
      const payload = {
        brand_id: bid,
        name: name.trim(),
        size_class: size,
        pieces_per_set: Number(pieces) || 4,
        product_line_id: Number(lineId),
        barcode: barcode.trim() || undefined,
      };
      if (item) {
        await updateItem.mutateAsync({ id: item.id, ...payload });
        toast.success("Item updated");
      } else {
        const res = await createItem.mutateAsync(payload);
        toast.success(`Item added · barcode ${res.barcode}`);
      }
      onDone();
    } catch (e: any) {
      toast.error("Couldn't save item", { description: e?.message });
    }
  };

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{item ? "Edit item" : "Add item"}</DialogTitle>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-1.5">
          <Label>Brand</Label>
          <Select
            value={brandId}
            onValueChange={(v) => {
              setBrandId(v);
              setNewBrand("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select brand" />
            </SelectTrigger>
            <SelectContent>
              {brands?.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            placeholder="…or type a new brand"
            value={newBrand}
            onChange={(e) => {
              setNewBrand(e.target.value);
              if (e.target.value) setBrandId("");
            }}
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Car model</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Baleno" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Size</Label>
            <Select value={size} onValueChange={(v) => setSize(v as CarItem["size_class"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Pieces per set</Label>
            <Input type="number" min={1} value={pieces} onChange={(e) => setPieces(e.target.value)} />
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>Product line</Label>
          <Select value={lineId} onValueChange={setLineId}>
            <SelectTrigger>
              <SelectValue placeholder="Rexine (R), PVC 1.8 mm…" />
            </SelectTrigger>
            <SelectContent>
              {lines?.map((l) => (
                <SelectItem key={l.id} value={String(l.id)}>
                  {l.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>Barcode</Label>
          <div className="flex gap-2">
            <Input
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan, type, or leave blank to generate"
              className="font-mono"
            />
            {!item && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Generate on save"
                onClick={() => setBarcode("")}
              >
                <Wand2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">Blank = RPS generates a 12-digit code on save.</p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save} disabled={!canSave || busy}>
          {item ? "Save changes" : "Add item"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
