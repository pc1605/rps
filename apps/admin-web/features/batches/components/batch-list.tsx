"use client";

import Link from "next/link";
import { useBatches } from "../hooks";
import type { Phase } from "../types";

const phaseColor: Record<Phase, string> = {
  cutting: "text-cyan-400 bg-cyan-950/40",
  stitching: "text-pink-400 bg-pink-950/40",
  packing: "text-amber-400 bg-amber-950/40",
  completed: "text-lime-400 bg-lime-950/40",
};

export function BatchList() {
  const { data: batches, isLoading, error } = useBatches();

  if (isLoading)
    return <p className="font-mono text-sm text-zinc-500">Loading batches…</p>;
  if (error)
    return (
      <p className="font-mono text-sm text-red-400">Failed to load batches.</p>
    );
  if (!batches?.length)
    return (
      <div className="rounded-xl border border-dashed border-zinc-800 p-12 text-center text-zinc-600 font-mono text-sm">
        No batches yet. Create your first one.
      </div>
    );

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-800">
      <table className="w-full">
        <thead className="bg-zinc-900/60">
          <tr className="text-left font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            <th className="px-4 py-3">Code</th>
            <th className="px-4 py-3">Model</th>
            <th className="px-4 py-3">Qty</th>
            <th className="px-4 py-3">Phase</th>
            <th className="px-4 py-3">Packed</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {batches.map((b) => (
            <tr
              key={b.id}
              className="border-t border-zinc-800 hover:bg-zinc-900/40"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/batches/${b.id}`}
                  className="font-mono text-sm text-amber-400 hover:underline"
                >
                  {b.batch_code}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="font-semibold text-sm">
                  {b.brand_name} {b.model_name}
                </div>
                <div className="font-mono text-[11px] text-zinc-500 uppercase">
                  {b.size_class}
                </div>
              </td>
              <td className="px-4 py-3 font-mono text-sm">{b.quantity}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded px-2 py-0.5 font-mono text-[11px] uppercase ${phaseColor[b.current_phase]}`}
                >
                  {b.current_phase}
                </span>
              </td>
              <td className="px-4 py-3 font-mono text-sm text-zinc-400">
                {b.units_packed}/{b.units_total}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">
                {new Date(b.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
