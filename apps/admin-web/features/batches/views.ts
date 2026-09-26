import type { Batch, BatchStats } from "./types";

export type BatchView = "cutting" | "ready" | "stitching" | "packing" | "completed";

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
    filter: (b) => b.current_phase === "cutting",
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
    filter: (b) => b.current_phase === "stitching" && b.status !== "awaiting_assignment",
    count: (s) => s.in_stitching,
  },
  {
    key: "packing",
    label: "Packing",
    dot: "bg-phase-packing",
    filter: (b) => b.current_phase === "packing",
    count: (s) => s.in_packing,
  },
  {
    key: "completed",
    label: "Completed",
    dot: "bg-phase-completed",
    filter: (b) => b.current_phase === "completed",
  },
];
