"use client";

import { MATERIAL_UNIT_LABEL } from "@rps/shared";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCarItems } from "@/features/catalog/hooks";
import { useLots, useMaterialTypes } from "@/features/materials/hooks";

/** Roll = a lot of the car's sheet material (type code = product line code, migration 015). "" = unassigned. */
export function RollSelect({
  id,
  carModelId,
  value,
  onChange,
}: {
  id: string;
  carModelId: number | "";
  value: string;
  onChange: (rollId: string) => void;
}) {
  const { data: cars } = useCarItems();
  const { data: lots } = useLots({ active: true });
  const { data: types } = useMaterialTypes();
  const car = cars?.find((c) => c.id === carModelId);
  const sheetTypes = new Set((types ?? []).filter((t) => t.has_variants).map((t) => t.code));
  const rolls = (lots ?? []).filter((l) =>
    car?.line_code ? l.type_code === car.line_code : sheetTypes.has(l.type_code),
  );
  return (
    <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? "" : v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Unassigned" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">Unassigned</SelectItem>
        {rolls.map((r) => (
          <SelectItem key={r.id} value={r.id}>
            <span className="font-mono">{r.lot_code}</span> · {r.type_name}
            {r.variant_name ? ` ${r.variant_name}` : ""} · {r.color} ·{" "}
            <span className="tabular">
              {r.qty_remaining} {MATERIAL_UNIT_LABEL[r.unit]}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
