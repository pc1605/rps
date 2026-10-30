import { REWORK_REASON_LABEL, type ReworkReason } from "@rps/shared";
import { Chip } from "@/components/rps/chip";
import { cn } from "@/lib/utils";

export const REWORK_REASON_EMOJI: Record<ReworkReason, string> = {
  stitching_fault: "🧵",
  stain: "💧",
  cutting_fault: "✂️",
  material_defect: "🧻",
  other: "❓",
};

export const reworkReasonTone = {
  text: "text-danger",
  border: "border-danger/30",
  bg: "bg-danger/10",
} as const;

export function ReasonChip({ reason, className }: { reason: ReworkReason; className?: string }) {
  const emoji = REWORK_REASON_EMOJI[reason] ?? "❓";
  const label = REWORK_REASON_LABEL[reason] ?? reason;

  return (
    <Chip tone={reworkReasonTone} className={cn("gap-1 font-normal", className)}>
      <span aria-hidden>{emoji}</span>
      <span>{label}</span>
    </Chip>
  );
}
