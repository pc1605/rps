import { PHASE_LABEL, SIZE_LABEL, STATUS_LABEL } from "@rps/shared";
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
    label: PHASE_LABEL.cutting,
  },
  stitching: {
    text: "text-phase-stitching",
    bg: "bg-phase-stitching/10",
    dot: "bg-phase-stitching",
    border: "border-phase-stitching/30",
    label: PHASE_LABEL.stitching,
  },
  packing: {
    text: "text-phase-packing",
    bg: "bg-phase-packing/10",
    dot: "bg-phase-packing",
    border: "border-phase-packing/30",
    label: PHASE_LABEL.packing,
  },
  completed: {
    text: "text-phase-completed",
    bg: "bg-phase-completed/10",
    dot: "bg-phase-completed",
    border: "border-phase-completed/30",
    label: PHASE_LABEL.completed,
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
    label: STATUS_LABEL.awaiting_assignment ?? "",
  },
  cancelled: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    dot: "bg-muted-foreground",
    border: "border-border",
    label: STATUS_LABEL.cancelled ?? "",
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

export const sizeLabel = SIZE_LABEL;

/** Resolve the display tone for a batch (status wins over phase). */
export function batchTone(phase: Phase, status: Status) {
  return statusTone[status] ?? phaseTone[phase];
}
