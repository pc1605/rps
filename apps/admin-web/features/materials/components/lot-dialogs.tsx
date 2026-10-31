"use client";

import { MATERIAL_UNIT_LABEL, type MaterialLotRow } from "@rps/shared";
import { Minus, PackagePlus, Pencil, Plus, SlidersHorizontal } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdjust,
  useMaterialTypes,
  usePatchLot,
  useReceive,
  useReturn,
  useVariants,
  useWaste,
} from "../hooks";

/** "12", "12.5", "0.125" → number; null when empty or not a plain decimal with ≤ maxDp places. */
export function parseQty(s: string, maxDp = 3): number | null {
  const t = s.trim();
  if (!new RegExp(`^\\d+(\\.\\d{1,${maxDp}})?$`).test(t)) return null;
  return Number(t);
}

function Field({
  id,
  label,
  hint,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label} {hint && <span className="font-normal text-muted-foreground">{hint}</span>}
      </Label>
      {children}
    </div>
  );
}

const err = (title: string) => (e: unknown) => toast.error(title, { description: (e as Error).message });

// ───── Receive ─────

export function ReceiveLotDialog({ defaultTypeId }: { defaultTypeId?: number }) {
  const [open, setOpen] = useState(false);
  const { data: types } = useMaterialTypes();
  const [typeId, setTypeId] = useState<number | undefined>(defaultTypeId);
  const [variantId, setVariantId] = useState<number | undefined>();
  const [code, setCode] = useState("");
  const [color, setColor] = useState("");
  const [qty, setQty] = useState("");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");
  const [note, setNote] = useState("");
  const receive = useReceive();
  const type = types?.find((t) => t.id === typeId);
  const { data: variants } = useVariants(type?.has_variants ? typeId : undefined);

  const q = parseQty(qty);
  const c = cost.trim() ? parseQty(cost, 2) : undefined;
  const ok =
    !!type &&
    (!type.has_variants || !!variantId) &&
    code.trim() &&
    color.trim() &&
    q != null &&
    q > 0 &&
    c !== null;

  const reset = () => {
    setTypeId(defaultTypeId);
    setVariantId(undefined);
    setCode("");
    setColor("");
    setQty("");
    setCost("");
    setSupplier("");
    setNote("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || !type || q == null) return;
    try {
      const lot = await receive.mutateAsync({
        material_type_id: type.id,
        variant_id: type.has_variants ? variantId : undefined,
        lot_code: code.trim(),
        color: color.trim(),
        qty: q,
        unit_cost: c ?? undefined,
        supplier: supplier.trim() || undefined,
        note: note.trim() || undefined,
      });
      toast.success(`Received ${lot.lot_code}`, {
        description: `${lot.qty_received} ${MATERIAL_UNIT_LABEL[lot.unit]} of ${lot.type_name}`,
      });
      reset();
      setOpen(false);
    } catch (e) {
      err("Couldn't receive lot")(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button type="button">
          <PackagePlus className="h-4 w-4" aria-hidden /> Receive lot
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Receive a lot</DialogTitle>
            <DialogDescription>A roll, box or pack arriving at the factory.</DialogDescription>
          </DialogHeader>
          <Field id="rcv-type" label="Material">
            <Select
              value={typeId ? String(typeId) : ""}
              onValueChange={(v) => {
                setTypeId(Number(v));
                setVariantId(undefined);
              }}
            >
              <SelectTrigger id="rcv-type" className="w-full">
                <SelectValue placeholder="Choose material" />
              </SelectTrigger>
              <SelectContent>
                {(types ?? [])
                  .filter((t) => t.is_active)
                  .map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name} <span className="text-muted-foreground">({MATERIAL_UNIT_LABEL[t.unit]})</span>
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </Field>
          {type?.has_variants && (
            <Field id="rcv-variant" label="Width / spec">
              <Select
                value={variantId ? String(variantId) : ""}
                onValueChange={(v) => setVariantId(Number(v))}
              >
                <SelectTrigger id="rcv-variant" className="w-full">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  {(variants ?? [])
                    .filter((v) => v.is_active)
                    .map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field id="rcv-code" label="Lot code">
              <Input
                id="rcv-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="R-014"
              />
            </Field>
            <Field id="rcv-color" label="Colour">
              <Input
                id="rcv-color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder="Jet Black"
              />
            </Field>
            <Field
              id="rcv-qty"
              label="Quantity"
              hint={type ? `(${MATERIAL_UNIT_LABEL[type.unit]})` : undefined}
            >
              <Input
                id="rcv-qty"
                inputMode="decimal"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="50"
              />
            </Field>
            <Field
              id="rcv-cost"
              label="Cost"
              hint={type ? `(₹/${MATERIAL_UNIT_LABEL[type.unit]}, optional)` : "(optional)"}
            >
              <Input
                id="rcv-cost"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
          </div>
          <Field id="rcv-supplier" label="Supplier" hint="(optional)">
            <Input id="rcv-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <Field id="rcv-note" label="Note" hint="(optional)">
            <Textarea id="rcv-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {qty && q == null && (
            <p className="text-caption text-danger">Quantity: a number with at most 3 decimals.</p>
          )}
          {cost && c === null && (
            <p className="text-caption text-danger">Cost: a number with at most 2 decimals.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok || receive.isPending}>
              {receive.isPending ? "Receiving…" : "Receive"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───── Adjust / waste / return ─────

type Kind = "adjust" | "waste" | "return";
const kindCopy: Record<Kind, { button: string; title: string; qtyLabel: string; icon: React.ElementType }> = {
  adjust: {
    button: "Adjust",
    title: "Correct the remaining quantity",
    qtyLabel: "Actual remaining",
    icon: SlidersHorizontal,
  },
  waste: { button: "Waste", title: "Record waste", qtyLabel: "Wasted", icon: Minus },
  return: { button: "Return", title: "Return to stock", qtyLabel: "Returned", icon: Plus },
};

export function LotMovementDialog({ lot, kind }: { lot: MaterialLotRow; kind: Kind }) {
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");
  const adjust = useAdjust();
  const waste = useWaste();
  const ret = useReturn();
  const unit = MATERIAL_UNIT_LABEL[lot.unit];
  const copy = kindCopy[kind];
  const Icon = copy.icon;
  const q = parseQty(qty);
  const pending = adjust.isPending || waste.isPending || ret.isPending;
  const tooMuch = kind === "waste" && q != null && q > lot.qty_remaining;
  const ok = q != null && (kind === "adjust" ? q !== lot.qty_remaining : q > 0) && !tooMuch && reason.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok || q == null) return;
    try {
      const r = reason.trim();
      const out =
        kind === "adjust"
          ? await adjust.mutateAsync({ id: lot.id, new_remaining: q, reason: r })
          : kind === "waste"
            ? await waste.mutateAsync({ id: lot.id, qty: q, reason: r })
            : await ret.mutateAsync({ id: lot.id, qty: q, reason: r });
      toast.success(`${lot.lot_code}: ${out.qty_remaining} ${unit} left`);
      setOpen(false);
    } catch (e) {
      err(`Couldn't ${copy.button.toLowerCase()}`)(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        setQty(kind === "adjust" && o ? String(lot.qty_remaining) : "");
        setReason("");
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Icon className="h-3.5 w-3.5" aria-hidden /> {copy.button}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>
              {lot.lot_code} · {lot.type_name} · {lot.qty_remaining} {unit} left now
            </DialogDescription>
          </DialogHeader>
          <Field id={`mv-qty-${kind}`} label={copy.qtyLabel} hint={`(${unit})`}>
            <Input
              id={`mv-qty-${kind}`}
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              autoFocus
            />
          </Field>
          <Field id={`mv-reason-${kind}`} label="Reason">
            <Input
              id={`mv-reason-${kind}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={kind === "adjust" ? "Stock count" : kind === "waste" ? "Torn edge" : "Offcut back"}
            />
          </Field>
          {qty && q == null && <p className="text-caption text-danger">A number with at most 3 decimals.</p>}
          {tooMuch && (
            <p className="text-caption text-danger">
              Only {lot.qty_remaining} {unit} left.
            </p>
          )}
          {kind === "adjust" && q != null && q !== lot.qty_remaining && (
            <p className="text-caption text-muted-foreground">
              Records {q > lot.qty_remaining ? "+" : ""}
              {Math.round((q - lot.qty_remaining) * 1000) / 1000} {unit} in the ledger.
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok || pending}>
              {copy.button}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───── Edit / re-classify ─────

export function EditLotDialog({ lot, hasConsumption }: { lot: MaterialLotRow; hasConsumption: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: types } = useMaterialTypes();
  const [color, setColor] = useState(lot.color);
  const [supplier, setSupplier] = useState(lot.supplier ?? "");
  const [cost, setCost] = useState(lot.unit_cost != null ? String(lot.unit_cost) : "");
  const [note, setNote] = useState(lot.note ?? "");
  const [active, setActive] = useState(lot.is_active);
  const [typeId, setTypeId] = useState(lot.material_type_id);
  const [variantId, setVariantId] = useState<number | undefined>(lot.variant_id);
  const type = types?.find((t) => t.id === typeId);
  const { data: variants } = useVariants(type?.has_variants ? typeId : undefined);
  const patch = usePatchLot();
  const c = cost.trim() ? parseQty(cost, 2) : undefined;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (c === null || !color.trim()) return;
    const reclass = typeId !== lot.material_type_id || (variantId ?? null) !== (lot.variant_id ?? null);
    try {
      await patch.mutateAsync({
        id: lot.id,
        color: color.trim(),
        supplier: supplier.trim() || null,
        note: note.trim() || null,
        unit_cost: c ?? null,
        is_active: active,
        ...(reclass
          ? { material_type_id: typeId, variant_id: type?.has_variants ? (variantId ?? null) : null }
          : {}),
      });
      toast.success(`${lot.lot_code} updated`);
      setOpen(false);
    } catch (e) {
      err("Couldn't update lot")(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setColor(lot.color);
          setSupplier(lot.supplier ?? "");
          setCost(lot.unit_cost != null ? String(lot.unit_cost) : "");
          setNote(lot.note ?? "");
          setActive(lot.is_active);
          setTypeId(lot.material_type_id);
          setVariantId(lot.variant_id);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit {lot.lot_code}</DialogTitle>
            <DialogDescription>
              Quantities change only through receive / adjust / waste / return.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field id="lot-type" label="Material">
              <Select
                value={String(typeId)}
                disabled={hasConsumption}
                onValueChange={(v) => {
                  setTypeId(Number(v));
                  setVariantId(undefined);
                }}
              >
                <SelectTrigger id="lot-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(types ?? []).map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {type?.has_variants && (
              <Field id="lot-variant" label="Width / spec">
                <Select
                  value={variantId ? String(variantId) : ""}
                  disabled={hasConsumption}
                  onValueChange={(v) => setVariantId(Number(v))}
                >
                  <SelectTrigger id="lot-variant" className="w-full">
                    <SelectValue placeholder="Unknown" />
                  </SelectTrigger>
                  <SelectContent>
                    {(variants ?? []).map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}
          </div>
          {hasConsumption && (
            <p className="text-caption text-muted-foreground">
              Material and width are locked: this lot already has consumption, waste or returns.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field id="lot-color" label="Colour">
              <Input id="lot-color" value={color} onChange={(e) => setColor(e.target.value)} />
            </Field>
            <Field id="lot-cost" label="Cost" hint="(₹, optional)">
              <Input
                id="lot-cost"
                inputMode="decimal"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
          </div>
          <Field id="lot-supplier" label="Supplier" hint="(optional)">
            <Input id="lot-supplier" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          </Field>
          <Field id="lot-note" label="Note" hint="(optional)">
            <Textarea id="lot-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="lot-active">In use (shows in pickers and FIFO)</Label>
            <Switch id="lot-active" checked={active} onCheckedChange={setActive} />
          </div>
          {cost && c === null && (
            <p className="text-caption text-danger">Cost: a number with at most 2 decimals.</p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={patch.isPending || c === null || !color.trim()}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
