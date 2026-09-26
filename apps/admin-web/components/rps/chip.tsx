import { cn } from "@/lib/utils";

type Tone = { text: string; border: string; bg?: string; dot?: string };

export function Chip({
  tone,
  children,
  dot = false,
  className,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-caption font-medium",
        tone.text,
        tone.border,
        tone.bg,
        className,
      )}
    >
      {dot && tone.dot && <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />}
      {children}
    </span>
  );
}
