import { cn } from "@/lib/utils";

/** Big tabular numeral with a quiet label — the product's signature element. */
export function Stat({
  value,
  of,
  label,
  tone,
  size = "md",
  className,
}: {
  value: number | string;
  of?: number | string;
  label?: string;
  tone?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const num = {
    sm: "text-h2",
    md: "text-display",
    lg: "text-[3.5rem] leading-none",
  }[size];
  return (
    <div className={cn("flex flex-col", className)}>
      <div className={cn("tabular font-semibold leading-none tracking-tight", num, tone)}>
        {value}
        {of !== undefined && <span className="text-muted-foreground font-normal"> / {of}</span>}
      </div>
      {label && <div className="mt-1 text-small text-muted-foreground">{label}</div>}
    </div>
  );
}
