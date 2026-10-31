"use client";

import {
  type ConsumptionGroupRow,
  MATERIAL_UNIT_LABEL,
  type RecipeGridGroup,
  SIZE_LABEL,
  type SizeClass,
} from "@rps/shared";
import { AlertTriangle, BookOpen, Pencil, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { type Column, DataTable } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { PageHeader, SectionTitle } from "@/components/rps/section";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useProductLines } from "@/features/catalog/hooks";
import { DeleteButton, groupBlocked } from "@/features/materials/components/delete-button";
import { type Draft, fromDrafts, LinesEditor, toDrafts } from "@/features/materials/components/lines-editor";
import { MaterialsNav } from "@/features/materials/components/materials-nav";
import {
  useCreateGroup,
  useDeleteGroup,
  useGroups,
  useMaterialTypes,
  usePutRecipeLines,
  useRecipeGrid,
  useUpdateGroup,
} from "@/features/materials/hooks";

const fail = (t: string) => (e: unknown) => toast.error(t, { description: (e as Error).message });

// ───── recipe column editor ─────

function EditRecipeDialog({ lineId, lineName, g }: { lineId: number; lineName: string; g: RecipeGridGroup }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const put = usePutRecipeLines();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = fromDrafts(drafts, false);
    if (typeof lines === "string") return toast.error(lines);
    try {
      await put.mutateAsync({ lineId, groupId: g.group.id, lines });
      toast.success(`Recipe saved: ${lineName} × ${g.group.name}`);
      setOpen(false);
    } catch (e) {
      fail("Couldn't save recipe")(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDrafts(toDrafts(g.lines));
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Edit recipe ${lineName} × ${g.group.name}`}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>
              {lineName} × {g.group.name}
            </DialogTitle>
            <DialogDescription>
              Quantity per mat. A width-specific line wins over "Any width" when the lot used has that width.
            </DialogDescription>
          </DialogHeader>
          <LinesEditor drafts={drafts} setDrafts={setDrafts} allowZero={false} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={put.isPending}>
              Save recipe
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ───── groups ─────

const SIZES: SizeClass[] = ["small", "medium", "large"];

function GroupDialog({ group }: { group?: ConsumptionGroupRow }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sort, setSort] = useState("");
  const [size, setSize] = useState<string>("none");
  const [active, setActive] = useState(true);
  const create = useCreateGroup();
  const update = useUpdateGroup();
  const del = useDeleteGroup();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const body = {
      name: name.trim(),
      sort: sort ? Number(sort) : undefined,
      default_for_size: size === "none" ? null : (size as SizeClass),
      is_active: active,
    };
    try {
      if (group) await update.mutateAsync({ id: group.id, ...body });
      else await create.mutateAsync(body);
      toast.success(`${name.trim()} saved`);
      setOpen(false);
    } catch (e) {
      fail("Couldn't save group")(e);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setName(group?.name ?? "");
          setSort(group ? String(group.sort) : "");
          setSize(group?.default_for_size ?? "none");
          setActive(group?.is_active ?? true);
        }
      }}
    >
      <DialogTrigger asChild>
        {group ? (
          <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${group.name}`}>
            <Pencil className="h-3.5 w-3.5" aria-hidden /> Edit
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm">
            <Plus className="h-3.5 w-3.5" aria-hidden /> New group
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{group ? `Edit ${group.name}` : "New consumption group"}</DialogTitle>
            <DialogDescription>
              Cars in a group share a recipe per product line (e.g. "XL 7-seater").
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cg-name">Name</Label>
            <Input id="cg-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="cg-size">Default for new cars of size</Label>
              <Select value={size} onValueChange={setSize}>
                <SelectTrigger id="cg-size" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {SIZES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SIZE_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cg-sort">
                Order <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="cg-sort"
                inputMode="numeric"
                value={sort}
                onChange={(e) => setSort(e.target.value.replace(/\D/g, ""))}
                aria-describedby="cg-sort-hint"
              />
              <p id="cg-sort-hint" className="text-caption text-muted-foreground">
                Lower shows first. Blank = at the end.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="cg-active">Active</Label>
            <Switch id="cg-active" checked={active} onCheckedChange={setActive} />
          </div>
          {group?.is_active && !active && group.car_count > 0 && (
            <p className="text-caption text-danger">
              {group.car_count} car{group.car_count === 1 ? "" : "s"} still use this group — move them to
              another group first.
            </p>
          )}
          <DialogFooter>
            {group && (
              <DeleteButton
                name={group.name}
                blocked={groupBlocked(group)}
                onDelete={async () => {
                  await del.mutateAsync(group.id);
                  setOpen(false);
                }}
              />
            )}
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!name.trim() || create.isPending || update.isPending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

const groupColumns: Column<ConsumptionGroupRow>[] = [
  {
    key: "name",
    header: "Group",
    card: "title",
    cell: (g) => (
      <span className="font-medium">
        {g.name}
        {!g.is_active && <span className="ml-2 text-caption text-muted-foreground">inactive</span>}
      </span>
    ),
  },
  {
    key: "size",
    header: "Default for size",
    cell: (g) =>
      g.default_for_size ? SIZE_LABEL[g.default_for_size] : <span className="text-muted-foreground">—</span>,
  },
  {
    key: "cars",
    header: "Cars",
    align: "right",
    cell: (g) => <span className="tabular">{g.car_count}</span>,
  },
  { key: "edit", header: "", align: "right", cell: (g) => <GroupDialog group={g} /> },
];

// ───── page ─────

function Recipes() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: lines } = useProductLines();
  const lineId = Number(sp.get("line")) || lines?.[0]?.id;
  const line = lines?.find((l) => l.id === lineId);
  const { data: grid, isPending, isError } = useRecipeGrid(lineId);
  const { data: types } = useMaterialTypes();
  const { data: groups } = useGroups();

  const cols = (grid?.groups ?? []).filter((g) => g.group.is_active || g.lines.length > 0);
  // Rows: every (type, variant) used in any column, in material order, "any width" first.
  const rowKeys = new Map<
    string,
    { typeId: number; typeName: string; variantId?: number; variantName?: string; sort: number; unit: string }
  >();
  for (const g of cols)
    for (const l of g.lines) {
      const k = `${l.material_type_id}/${l.variant_id ?? 0}`;
      if (!rowKeys.has(k))
        rowKeys.set(k, {
          typeId: l.material_type_id,
          typeName: l.type_name,
          variantId: l.variant_id,
          variantName: l.variant_name,
          sort: types?.find((t) => t.id === l.material_type_id)?.sort ?? 0,
          unit: MATERIAL_UNIT_LABEL[l.unit],
        });
    }
  const rows = [...rowKeys.values()].sort(
    (a, b) =>
      a.sort - b.sort || a.typeId - b.typeId || (a.variantName ?? "").localeCompare(b.variantName ?? ""),
  );
  const cell = (g: RecipeGridGroup, typeId: number, variantId?: number) =>
    g.lines.find((l) => l.material_type_id === typeId && (l.variant_id ?? 0) === (variantId ?? 0))
      ?.qty_per_mat;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Recipes: quantity per mat for each product line × consumption group."
      />
      <MaterialsNav />
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="recipe-line" className="text-small text-muted-foreground">
          Product line
        </Label>
        <Select
          value={lineId ? String(lineId) : ""}
          onValueChange={(v) => router.replace(`${pathname}?line=${v}`, { scroll: false })}
        >
          <SelectTrigger id="recipe-line" className="w-48">
            <SelectValue placeholder="Choose" />
          </SelectTrigger>
          <SelectContent>
            {(lines ?? []).map((l) => (
              <SelectItem key={l.id} value={String(l.id)}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isError ? (
        <EmptyState title="Couldn't load recipes" />
      ) : isPending || !grid ? (
        <Skeleton className="h-48 w-full" />
      ) : (
        <Card className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="h-11 px-4 text-caption text-muted-foreground">Material</TableHead>
                {cols.map((g) => (
                  <TableHead
                    key={g.group.id}
                    className="h-11 px-4 text-right text-caption text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-1">
                      {g.group.name}
                      {line && <EditRecipeDialog lineId={line.id} lineName={line.name} g={g} />}
                    </span>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={cols.length + 1}
                    className="px-4 py-8 text-center text-small text-muted-foreground"
                  >
                    No recipe lines for {line?.name ?? "this line"} yet — use ✎ on a group to add them.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={`${r.typeId}/${r.variantId ?? 0}`}>
                    <TableCell className="px-4 py-2.5 text-small">
                      {r.variantName ? (
                        <span className="pl-4 text-muted-foreground">{r.variantName}</span>
                      ) : (
                        r.typeName
                      )}
                      <span className="ml-1 text-caption text-muted-foreground">
                        {r.variantName ? "" : `(${r.unit} / mat)`}
                      </span>
                    </TableCell>
                    {cols.map((g) => {
                      const v = cell(g, r.typeId, r.variantId);
                      return (
                        <TableCell key={g.group.id} className="tabular px-4 py-2.5 text-right text-small">
                          {v ?? <span className="text-muted-foreground/50">—</span>}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      )}
      {cols.some((g) => g.note?.includes("PLACEHOLDER")) && (
        <p className="flex items-center gap-2 text-small text-danger">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Some recipes still hold PLACEHOLDER numbers from
          the seed — replace them with the owner's figures before relying on consumption.
        </p>
      )}

      <section className="space-y-3">
        <SectionTitle aside={<GroupDialog />}>Consumption groups</SectionTitle>
        <DataTable
          rows={groups ?? []}
          columns={groupColumns}
          rowKey={(g) => String(g.id)}
          empty={<EmptyState icon={BookOpen} title="No groups" />}
        />
        <p className="text-caption text-muted-foreground">
          A car's group is set on the car. A group can't be deactivated while cars use it or while it's a size
          default.
        </p>
      </section>
    </div>
  );
}

export default function RecipesPage() {
  return (
    <Suspense fallback={null}>
      <Recipes />
    </Suspense>
  );
}
