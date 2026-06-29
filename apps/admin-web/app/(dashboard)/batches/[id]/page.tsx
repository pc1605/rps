"use client";

import { use } from "react";
import Link from "next/link";
import { useBatch } from "@/features/batches/hooks";

export default function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: batch, isLoading, error } = useBatch(id);

  if (isLoading)
    return <p className="font-mono text-sm text-zinc-500">Loading…</p>;
  if (error || !batch)
    return <p className="font-mono text-sm text-red-400">Batch not found.</p>;

  return (
    <>
      <Link
        href="/batches"
        className="font-mono text-xs text-zinc-500 hover:text-amber-400"
      >
        ← Batches
      </Link>
      <div className="mt-2 mb-6">
        <h2 className="text-3xl font-extrabold font-mono text-amber-400">
          {batch.batch_code}
        </h2>
        <p className="text-zinc-300 mt-1">
          {batch.brand_name} {batch.model_name} · {batch.quantity} mats ·{" "}
          {batch.size_class}
        </p>
        {batch.notes && (
          <p className="text-zinc-500 text-sm mt-2">✎ {batch.notes}</p>
        )}
      </div>

      <h3 className="font-mono text-xs uppercase tracking-wider text-zinc-500 mb-3">
        Units · {batch.units_packed}/{batch.units_total} packed
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
        {batch.units.map((u) => (
          <div
            key={u.id}
            className="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3"
          >
            <div className="font-mono text-xs text-zinc-300">{u.unit_code}</div>
            <div className="font-mono text-[10px] uppercase text-zinc-500 mt-1">
              {u.status}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
