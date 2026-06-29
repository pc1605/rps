"use client";

import { useState } from "react";
import { useCarModels, useRolls, useCreateBatch } from "../hooks";
import { CarModelSelect } from "./car-model-select";

export function CreateBatchDialog() {
  const [open, setOpen] = useState(false);
  const [carModelId, setCarModelId] = useState<number | "">("");
  const [rollId, setRollId] = useState<string>("");
  const [quantity, setQuantity] = useState<number | "">("");
  const [notes, setNotes] = useState("");

  const { data: models } = useCarModels();
  const { data: rolls } = useRolls();
  const createBatch = useCreateBatch();

  const reset = () => {
    setCarModelId("");
    setRollId("");
    setQuantity("");
    setNotes("");
  };

  const submit = async () => {
    if (!carModelId || !quantity) return;
    await createBatch.mutateAsync({
      car_model_id: Number(carModelId),
      roll_id: rollId || undefined,
      quantity: Number(quantity),
      notes: notes || undefined,
    });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400"
      >
        ＋ New Batch
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h3 className="text-xl font-bold mb-4">Create batch</h3>

        <label className="block font-mono text-xs uppercase tracking-wider text-muted-foreground mb-2">
          Car model
        </label>
        <div className="mb-4">
          <CarModelSelect value={carModelId} onChange={setCarModelId} />
        </div>

        <label className="block font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">
          Quantity
        </label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) =>
            setQuantity(e.target.value ? Number(e.target.value) : "")
          }
          placeholder="10"
          className="w-full mb-4 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
        />

        <label className="block font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">
          Rexine roll (optional)
        </label>
        <select
          value={rollId}
          onChange={(e) => setRollId(e.target.value)}
          className="w-full mb-4 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
        >
          <option value="">Unassigned</option>
          {rolls?.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roll_code} — {r.color} ({r.remaining_meters}m)
            </option>
          ))}
        </select>

        <label className="block font-mono text-xs uppercase tracking-wider text-zinc-500 mb-2">
          Notes (optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="w-full mb-4 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100"
        />

        {createBatch.error && (
          <p className="mb-4 rounded-lg bg-red-950 border border-red-900 px-4 py-2 text-sm text-red-400">
            {(createBatch.error as Error).message}
          </p>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!carModelId || !quantity || createBatch.isPending}
            className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40"
          >
            {createBatch.isPending ? "Creating…" : "Create batch"}
          </button>
        </div>
      </div>
    </div>
  );
}
