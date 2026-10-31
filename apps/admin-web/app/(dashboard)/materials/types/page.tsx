"use client";

import {
  MATERIAL_UNIT_LABEL,
  type MaterialTypeRow,
  type MaterialUnit,
  type MaterialVariantRow,
} from "@rps/shared";
import { Layers, Pencil, Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/rps/chip";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader } from "@/components/rps/section";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { DeleteButton, typeBlocked } from "@/features/materials/components/delete-button";
import { parseQty } from "@/features/materials/components/lot-dialogs";
import { MaterialsNav } from "@/features/materials/components/materials-nav";
import {
  useCreateType,
  useCreateVariant,
  useDeleteType,
  useMaterialTypes,
  useUpdateType,
  useUpdateVariant,
  useVariants,
} from "@/features/materials/hooks";

const UNITS: MaterialUnit[] = ["m", "sqm", "pcs", "spool", "kg"];
const fail = (t: string) => (e: unknown) => toast.error(t, { description: (e as Error).message });

function TypeDialog({ type }: { type?: MaterialTypeRow }) {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<MaterialUnit>("m");
  const [hasVariants, setHasVariants] = useState(false);
  const [minLevel, setMinLevel] = useState("");
  const [sort, setSort] = useState("");
  const [active, setActive] = useState(true);
  const create = useCreateType();
  const update = useUpdateType();
  const del = useDeleteType();
  const min = minLevel.trim() ? parseQty(minLevel) : undefined;
  const ok = code.trim() && name.trim() && min !== null;

  const load = () => {
    setCode(type?.code ?? "");
    setName(type?.name ?? "");
    setUnit(type?.unit ?? "m");
    setHasVariants(type?.has_variants ?? false);
    setMinLevel(type?.min_level != null ? String(type.min_level) : "");
    setSort(type ? String(type.sort) : "");
    setActive(type?.is_active ?? true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    const body = {
      code: code.trim(),
      name: name.trim(),
      unit,
      has_variants: hasVariants,
      min_level: min ?? null,
      sort: sort.trim() ? Number(sort) : undefined,
      is_active: active,
    };
    try {
      if (type) await update.mutateAsync({ id: type.id, ...body });
      else await create.mutateAsync(body);
      toast.success(type ? `${name.trim()} saved` : `${name.trim()} added`);
      setOpen(false);
    } catch (e) {
      fail(type ? "Couldn't save material" : "Couldn't add material")(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) load();
      }}
    >
      <DialogTrigger asChild>
        {type ? (
          <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${type.name}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        ) : (
          <Button type="button">
            <Plus className="h-4 w-4" aria-hidden /> New material
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{type ? `Edit ${type.name}` : "New material type"}</DialogTitle>
            <DialogDescription>
              The unit can't change once the material has movements. Variants are specs that change
              consumption (e.g. roll width) — never colour.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="mt-code">Code</Label>
              <Input
                id="mt-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="VELCRO"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mt-name">Name</Label>
              <Input
                id="mt-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Velcro"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mt-unit">Unit</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as MaterialUnit)}>
                <SelectTrigger id="mt-unit" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {MATERIAL_UNIT_LABEL[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="mt-min">
                Low below <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="mt-min"
                inputMode="decimal"
                value={minLevel}
                onChange={(e) => setMinLevel(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mt-sort">
                Order <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="mt-sort"
                inputMode="numeric"
                value={sort}
                onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))}
                aria-describedby="mt-sort-hint"
              />
              <p id="mt-sort-hint" className="text-caption text-muted-foreground">
                Lower shows first. Blank = at the end.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="mt-variants">Has variants (e.g. roll widths)</Label>
            <Switch id="mt-variants" checked={hasVariants} onCheckedChange={setHasVariants} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="mt-active">Active</Label>
            <Switch id="mt-active" checked={active} onCheckedChange={setActive} />
          </div>
          {type?.is_active && !active && (type.recipe_lines > 0 || type.override_cars > 0) && (
            <p className="text-caption text-muted-foreground">
              Still used by{" "}
              {[
                type.recipe_lines > 0 &&
                  `${type.recipe_lines} recipe line${type.recipe_lines === 1 ? "" : "s"}`,
                type.override_cars > 0 &&
                  `overrides on ${type.override_cars} car${type.override_cars === 1 ? "" : "s"}`,
              ]
                .filter(Boolean)
                .join(" and ")}
              . While inactive it's skipped at cutting — nothing is planned or drawn for it.
            </p>
          )}
          {minLevel && min === null && (
            <p className="text-caption text-danger">Low level: a number with at most 3 decimals.</p>
          )}
          <DialogFooter>
            {type && (
              <DeleteButton
                name={type.name}
                blocked={typeBlocked(type)}
                onDelete={async () => {
                  await del.mutateAsync(type.id);
                  setOpen(false);
                }}
              />
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok || create.isPending || update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function VariantDialog({ type, variant }: { type: MaterialTypeRow; variant?: MaterialVariantRow }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [active, setActive] = useState(true);
  const create = useCreateVariant();
  const update = useUpdateVariant();
  const w = width.trim() ? Number(width) : undefined;
  const ok = name.trim() && (w === undefined || (Number.isFinite(w) && w > 0));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ok) return;
    // Keep any other spec keys; width_in is the one the UI edits.
    const specs: Record<string, unknown> = { ...(variant?.specs ?? {}) };
    if (w === undefined) delete specs.width_in;
    else specs.width_in = w;
    try {
      if (variant) await update.mutateAsync({ id: variant.id, name: name.trim(), specs, is_active: active });
      else await create.mutateAsync({ typeId: type.id, name: name.trim(), specs, is_active: active });
      toast.success(`${type.name} · ${name.trim()} saved`);
      setOpen(false);
    } catch (e) {
      fail("Couldn't save variant")(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(variant?.name ?? "");
          const wi = variant?.specs?.width_in;
          setWidth(typeof wi === "number" ? String(wi) : "");
          setActive(variant?.is_active ?? true);
        }
      }}
    >
      <DialogTrigger asChild>
        {variant ? (
          <button
            type="button"
            className="rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
            aria-label={`Edit variant ${variant.name}`}
          >
            <Chip
              tone={
                variant.is_active
                  ? { text: "text-foreground", border: "border-border" }
                  : { text: "text-muted-foreground", border: "border-border" }
              }
            >
              {variant.name}
              {!variant.is_active && " (off)"}
            </Chip>
          </button>
        ) : (
          <Button type="button" variant="ghost" size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden /> Add variant
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {variant ? `Edit ${type.name} · ${variant.name}` : `New ${type.name} variant`}
            </DialogTitle>
            <DialogDescription>
              A spec that changes how much a mat uses — usually the roll width.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="mv-name">Name</Label>
            <Input id="mv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="60″" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mv-width">
              Width (inches) <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="mv-width"
              inputMode="decimal"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder="60"
            />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="mv-active">Active</Label>
            <Switch id="mv-active" checked={active} onCheckedChange={setActive} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!ok || create.isPending || update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TypeCard({ t }: { t: MaterialTypeRow }) {
  const { data: variants } = useVariants(t.has_variants ? t.id : undefined);
  return (
    <Card className="space-y-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-medium">{t.name}</span>
            <span className="font-mono text-caption text-muted-foreground">{t.code}</span>
            {!t.is_active && (
              <Chip tone={{ text: "text-muted-foreground", border: "border-border" }}>inactive</Chip>
            )}
            {t.is_low && <Chip tone={{ text: "text-danger", border: "border-danger/30" }}>low</Chip>}
          </div>
          <div className="mt-1 text-caption text-muted-foreground">
            {t.stock_remaining} {MATERIAL_UNIT_LABEL[t.unit]} in {t.active_lots} lot
            {t.active_lots === 1 ? "" : "s"}
            {t.min_level != null && ` · low below ${t.min_level}`}
          </div>
        </div>
        <TypeDialog type={t} />
      </div>
      {t.has_variants && (
        <div className="flex flex-wrap items-center gap-1.5">
          {(variants ?? []).map((v) => (
            <VariantDialog key={v.id} type={t} variant={v} />
          ))}
          <VariantDialog type={t} />
        </div>
      )}
    </Card>
  );
}

export default function MaterialTypesPage() {
  const { data: types, isPending, isError } = useMaterialTypes();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Material types, their unit, low-stock level and variants."
        actions={<TypeDialog />}
      />
      <MaterialsNav />
      {isError ? (
        <EmptyState title="Couldn't load materials" />
      ) : isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : !types?.length ? (
        <EmptyState icon={Layers} title="No material types yet" action={<TypeDialog />} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {types.map((t) => (
            <TypeCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </div>
  );
}
