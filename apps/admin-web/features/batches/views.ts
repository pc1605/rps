import type { Batch, BatchStats } from "./types";

export type BatchView = "to_cut" | "cutting" | "ready" | "stitching" | "packing" | "completed" | "cancelled";

// A cancelled batch keeps the phase it stopped in; it only shows under "Cancelled" (mirrors list.go).
const live = (b: Batch) => b.status !== "cancelled";

export const batchViews: {
  key: BatchView;
  label: string;
  dot: string;
  filter: (b: Batch) => boolean;
  count?: (s: BatchStats) => number;
  /** Waits for the admin to assign someone (amber = act here). */
  assign?: boolean;
}[] = [
  {
    key: "to_cut",
    label: "Needs a cutter",
    dot: "bg-brand",
    filter: (b) => b.current_phase === "cutting" && b.status === "awaiting_assignment",
    count: (s) => s.needs_cutter,
    assign: true,
  },
  {
    key: "cutting",
    label: "Cutting",
    dot: "bg-phase-cutting",
    filter: (b) => b.current_phase === "cutting" && b.status !== "awaiting_assignment" && live(b),
    count: (s) => s.in_cutting,
  },
  {
    key: "ready",
    label: "Ready to stitch",
    dot: "bg-brand",
    filter: (b) => b.current_phase === "stitching" && b.status === "awaiting_assignment",
    count: (s) => s.awaiting_assignment,
    assign: true,
  },
  {
    key: "stitching",
    label: "Stitching",
    dot: "bg-phase-stitching",
    filter: (b) => b.current_phase === "stitching" && b.status !== "awaiting_assignment" && live(b),
    count: (s) => s.in_stitching,
  },
  {
    key: "packing",
    label: "Packing",
    dot: "bg-phase-packing",
    filter: (b) => b.current_phase === "packing" && live(b),
    count: (s) => s.in_packing,
  },
  {
    key: "completed",
    label: "Completed",
    dot: "bg-phase-completed",
    filter: (b) => b.current_phase === "completed",
  },
  {
    key: "cancelled",
    label: "Cancelled",
    dot: "bg-muted-foreground",
    filter: (b) => !live(b),
  },
];
