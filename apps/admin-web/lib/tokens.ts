import type { Phase, Status } from "@/features/batches/types";

/** Phase → utility classes. The ONLY place phase colors are defined on the web. */
export const phaseTone: Record<
  Phase,
  { text: string; bg: string; dot: string; border: string; label: string }
> = {
  cutting: {
    text: "text-phase-cutting",
    bg: "bg-phase-cutting/10",
    dot: "bg-phase-cutting",
    border: "border-phase-cutting/30",
    label: "Cutting",
  },
  stitching: {
    text: "text-phase-stitching",
    bg: "bg-phase-stitching/10",
    dot: "bg-phase-stitching",
    border: "border-phase-stitching/30",
    label: "Stitching",
  },
  packing: {
    text: "text-phase-packing",
    bg: "bg-phase-packing/10",
    dot: "bg-phase-packing",
    border: "border-phase-packing/30",
    label: "Packing",
  },
  completed: {
    text: "text-phase-completed",
    bg: "bg-phase-completed/10",
    dot: "bg-phase-completed",
    border: "border-phase-completed/30",
    label: "Completed",
  },
};

/** Special statuses that override the phase tone. */
export const statusTone: Partial<
  Record<Status, { text: string; bg: string; dot: string; border: string; label: string }>
> = {
  awaiting_assignment: {
    text: "text-brand",
    bg: "bg-brand/10",
    dot: "bg-brand",
    border: "border-brand/30",
    label: "Ready for stitching",
  },
  cancelled: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    dot: "bg-muted-foreground",
    border: "border-border",
    label: "Cancelled",
  },
};

export const stationTone = {
  cutter: phaseTone.cutting,
  stitcher: phaseTone.stitching,
  packer: phaseTone.packing,
} as const;

export const unitTone = {
  pending: { text: "text-muted-foreground", border: "border-border", label: "Pending" },
  stitched: { text: "text-phase-stitching", border: "border-phase-stitching/30", label: "Stitched" },
  packed: { text: "text-phase-completed", border: "border-phase-completed/30", label: "Packed" },
  defective: { text: "text-danger", border: "border-danger/30", label: "Defective" },
  rework: { text: "text-danger", border: "border-danger/30", label: "Rework" },
  dispatched: { text: "text-info", border: "border-info/30", label: "Dispatched" },
} as const;

export const sizeLabel: Record<string, string> = { small: "S", medium: "M", large: "L" };

/** Resolve the display tone for a batch (status wins over phase). */
export function batchTone(phase: Phase, status: Status) {
  return statusTone[status] ?? phaseTone[phase];
}
