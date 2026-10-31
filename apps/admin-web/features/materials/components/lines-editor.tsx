"use client";

import { MATERIAL_UNIT_LABEL, type MaterialLineInput, type MaterialTypeRow } from "@rps/shared";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMaterialTypes, useVariants } from "../hooks";
import { parseQty } from "./lot-dialogs";

// Editable list of (material, width, qty per mat) lines — recipes (qty > 0) and car overrides (qty ≥ 0).

export type Draft = { key: number; typeId?: number; variantId?: number; qty: string };

function LineRow({
  d,
  types,
  allowZero,
  onChange,
  onRemove,
}: {
  d: Draft;
  types: MaterialTypeRow[];
  allowZero: boolean;
  onChange: (d: Draft) => void;
  onRemove: () => void;
}) {
  const type = types.find((t) => t.id === d.typeId);
  const { data: variants } = useVariants(type?.has_variants ? d.typeId : undefined);
  const q = parseQty(d.qty);
  const bad = d.qty !== "" && (q == null || (!allowZero && q === 0));
  return (
    <div className="grid grid-cols-[1fr_8rem_6rem_auto] items-center gap-2">
      <Select
        value={d.typeId ? String(d.typeId) : ""}
        onValueChange={(v) => onChange({ ...d, typeId: Number(v), variantId: undefined })}
      >
        <SelectTrigger className="w-full" aria-label="Material">
          <SelectValue placeholder="Material" />
        </SelectTrigger>
        <SelectContent>
          {types.map((t) => (
            <SelectItem key={t.id} value={String(t.id)}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={d.variantId ? String(d.variantId) : "any"}
        disabled={!type?.has_variants}
        onValueChange={(v) => onChange({ ...d, variantId: v === "any" ? undefined : Number(v) })}
      >
        <SelectTrigger className="w-full" aria-label="Width">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any width</SelectItem>
          {(variants ?? []).map((v) => (
            <SelectItem key={v.id} value={String(v.id)}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="relative">
        <Input
          inputMode="decimal"
          value={d.qty}
          onChange={(e) => onChange({ ...d, qty: e.target.value })}
          aria-label="Quantity per mat"
          aria-invalid={bad}
          className={bad ? "border-danger" : undefined}
        />
        {type && (
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-caption text-muted-foreground">
            {MATERIAL_UNIT_LABEL[type.unit]}
          </span>
        )}
      </div>
      <Button type="button" variant="ghost" size="icon" onClick={onRemove} aria-label="Remove line">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

let nextKey = 1;
export function toDrafts(
  lines: { material_type_id: number; variant_id?: number; qty_per_mat: number }[],
): Draft[] {
  return lines.map((l) => ({
    key: nextKey++,
    typeId: l.material_type_id,
    variantId: l.variant_id,
    qty: String(l.qty_per_mat),
  }));
}

/** Validates drafts → API lines, or an error message. */
export function fromDrafts(drafts: Draft[], allowZero: boolean): MaterialLineInput[] | string {
  const seen = new Set<string>();
  const out: MaterialLineInput[] = [];
  for (const [i, d] of drafts.entries()) {
    if (!d.typeId) return `Line ${i + 1}: choose a material`;
    const q = parseQty(d.qty);
    if (q == null || (!allowZero && q === 0))
      return `Line ${i + 1}: ${allowZero ? "quantity ≥ 0" : "quantity > 0"}, at most 3 decimals`;
    const key = `${d.typeId}/${d.variantId ?? "any"}`;
    if (seen.has(key)) return `Line ${i + 1}: that material + width is already listed`;
    seen.add(key);
    out.push({ material_type_id: d.typeId, variant_id: d.variantId, qty_per_mat: q });
  }
  return out;
}

export function LinesEditor({
  drafts,
  setDrafts,
  allowZero,
}: {
  drafts: Draft[];
  setDrafts: (d: Draft[]) => void;
  allowZero: boolean;
}) {
  const { data: types } = useMaterialTypes();
  const active = (types ?? []).filter((t) => t.is_active);
  return (
    <div className="space-y-2">
      {drafts.length > 0 && (
        <div className="grid grid-cols-[1fr_8rem_6rem_auto] gap-2 text-caption text-muted-foreground">
          <span>Material</span>
          <span>Width</span>
          <span>Per mat</span>
          <span className="w-9" />
        </div>
      )}
      {drafts.map((d) => (
        <LineRow
          key={d.key}
          d={d}
          types={active}
          allowZero={allowZero}
          onChange={(nd) => setDrafts(drafts.map((x) => (x.key === d.key ? nd : x)))}
          onRemove={() => setDrafts(drafts.filter((x) => x.key !== d.key))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setDrafts([...drafts, { key: nextKey++, qty: "" }])}
      >
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add line
      </Button>
    </div>
  );
}
