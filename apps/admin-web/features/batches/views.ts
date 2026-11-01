import type { Batch, BatchStats } from "./types";

export type BatchView = "cutting" | "ready" | "stitching" | "packing" | "completed" | "cancelled";

// A cancelled batch keeps the phase it stopped in; it only shows under "Cancelled" (mirrors list.go).
const live = (b: Batch) => b.status !== "cancelled";

export const batchViews: {
  key: BatchView;
  label: string;
  dot: string;
  filter: (b: Batch) => boolean;
  count?: (s: BatchStats) => number;
}[] = [
  {
    key: "cutting",
    label: "Cutting",
    dot: "bg-phase-cutting",
    filter: (b) => b.current_phase === "cutting" && live(b),
    count: (s) => s.in_cutting,
  },
  {
    key: "ready",
    label: "Ready to stitch",
    dot: "bg-brand",
    filter: (b) => b.current_phase === "stitching" && b.status === "awaiting_assignment",
    count: (s) => s.awaiting_assignment,
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
