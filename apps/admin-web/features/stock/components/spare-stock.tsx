"use client";

import type { SpareStock as SpareRow } from "@rps/shared";
import { Layers } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DataTable, type Column } from "@/components/rps/data-table";
import { EmptyState } from "@/components/rps/empty-state";
import { BatchLink, CarLink } from "@/components/rps/entity-link";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fmtAgo } from "@/lib/format";
import { sizeLabel } from "@/lib/tokens";
import { useSpares, useWriteOffSpares } from "../hooks";

/** Spare mats left by cancelled batches, per car item. Reused from "New batch"; written off here. */
export function SpareStock() {
  const { data, isPending, isError } = useSpares();
  const [writeOff, setWriteOff] = useState<SpareRow | null>(null);

  if (isError)
    return <EmptyState title="Couldn't load spare mats" body="Check the backend is running, then reload." />;

  const columns: Column<SpareRow>[] = [
    {
      key: "item",
      header: "Item",
      card: "title",
      cell: (s) => (
        <div className="min-w-0">
          <CarLink id={s.car_model_id} className="font-medium">
            {s.brand_name} {s.model_name}
          </CarLink>
          <div className="text-caption text-muted-foreground">
            {sizeLabel[s.size_class] ?? s.size_class}
            {s.line_name ? ` · ${s.line_name}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "stitched",
      header: "Stitched",
      align: "right",
      cell: (s) => <span className="tabular">{s.stitched}</span>,
    },
    {
      key: "unstitched",
      header: "Cut, not stitched",
      align: "right",
      cell: (s) => <span className="tabular">{s.unstitched}</span>,
    },
    {
      key: "from",
      header: "From",
      cell: (s) => (
        <span className="flex flex-wrap gap-x-2 text-small">
          {s.sources.map((src) => (
            <span key={src.batch_id}>
              <BatchLink id={src.batch_id} code={src.batch_code} />{" "}
              <span className="tabular text-muted-foreground">×{src.count}</span>
            </span>
          ))}
        </span>
      ),
    },
    {
      key: "age",
      header: "Since",
      cell: (s) => <span className="text-small text-muted-foreground">{fmtAgo(s.oldest_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      cell: (s) => (
        <Button type="button" variant="outline" size="sm" onClick={() => setWriteOff(s)}>
          Write off
        </Button>
      ),
    },
  ];

  return (
    <>
      <DataTable
        rows={data ?? []}
        columns={columns}
        rowKey={(s) => String(s.car_model_id)}
        loading={isPending}
        empty={
          <EmptyState
            icon={Layers}
            title="No spare mats"
            body="When a batch is cancelled after cutting, its cut and stitched mats show up here."
          />
        }
      />
      {/* keyed: fresh counts (default = all of them) for each row */}
      <WriteOffDialog
        key={writeOff?.car_model_id ?? "none"}
        row={writeOff}
        onClose={() => setWriteOff(null)}
      />
    </>
  );
}

function WriteOffDialog({ row, onClose }: { row: SpareRow | null; onClose: () => void }) {
  const [stitched, setStitched] = useState(String(row?.stitched ?? 0));
  const [unstitched, setUnstitched] = useState(String(row?.unstitched ?? 0));
  const [note, setNote] = useState("");
  const writeOff = useWriteOffSpares();

  const st = Number(stitched);
  const un = Number(unstitched);
  const valid =
    !!row &&
    Number.isInteger(st) &&
    Number.isInteger(un) &&
    st >= 0 &&
    un >= 0 &&
    st <= row.stitched &&
    un <= row.unstitched &&
    st + un > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!row || !valid) return;
    try {
      await writeOff.mutateAsync({
        car_model_id: row.car_model_id,
        stitched: st,
        unstitched: un,
        note: note.trim() || undefined,
      });
      toast.success(`${st + un} spare ${st + un === 1 ? "mat" : "mats"} written off`);
      onClose();
    } catch (err) {
      toast.error("Couldn't write off", { description: (err as Error).message });
    }
  };

  return (
    <AlertDialog
      open={!!row}
      onOpenChange={(o) => {
        if (o) return;
        onClose();
      }}
    >
      <AlertDialogContent>
        {row && (
          <form onSubmit={submit} className="grid gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Write off spare {row.brand_name} {row.model_name}?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Oldest first. Written-off mats can't be reused. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="wo-stitched">Stitched (of {row.stitched})</Label>
                <Input
                  id="wo-stitched"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={row.stitched}
                  value={stitched}
                  onChange={(e) => setStitched(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="wo-unstitched">Not stitched (of {row.unstitched})</Label>
                <Input
                  id="wo-unstitched"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={row.unstitched}
                  value={unstitched}
                  onChange={(e) => setUnstitched(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="wo-note">
                Note <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea id="wo-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={writeOff.isPending}>
                Keep
              </AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!valid || writeOff.isPending}>
                {writeOff.isPending ? "Writing off…" : `Write off ${valid ? st + un : ""}`.trim()}
              </Button>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
