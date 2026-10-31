import Link from "next/link";
import { cn } from "@/lib/utils";

// One link style for every entity name (U1). Neutral, not amber: amber means "act here".
const base =
  "rounded-sm underline-offset-2 decoration-muted-foreground/50 hover:underline focus-visible:outline-2 focus-visible:outline-brand";

type Common = { className?: string; children?: React.ReactNode; title?: string };

export function WorkerLink({
  id,
  name,
  className,
  children,
}: Common & { id?: string | null; name?: string | null }) {
  if (!id) return <span className={className}>{children ?? name ?? "—"}</span>;
  return (
    <Link href={`/workers/${id}`} className={cn(base, className)} onClick={(e) => e.stopPropagation()}>
      {children ?? name}
    </Link>
  );
}

export function BatchLink({ id, code, className, children }: Common & { id: string; code: string }) {
  return (
    <Link
      href={`/batches/${id}`}
      className={cn(base, "font-mono", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? code}
    </Link>
  );
}

export function UnitLink({ code, className, children }: Common & { code: string }) {
  return (
    <Link
      href={`/units/${encodeURIComponent(code)}`}
      className={cn(base, "font-mono", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? code}
    </Link>
  );
}

export function CarLink({ id, className, children, title }: Common & { id?: number | null }) {
  if (!id) return <span className={className}>{children}</span>;
  return (
    <Link
      href={`/cars/${id}`}
      className={cn(base, className)}
      title={title}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </Link>
  );
}

export function LotLink({
  id,
  code,
  className,
  children,
}: Common & { id?: string | null; code?: string | null }) {
  if (!id) return <span className={cn("font-mono", className)}>{children ?? code ?? "—"}</span>;
  return (
    <Link
      href={`/materials/lots/${id}`}
      className={cn(base, "font-mono", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {children ?? code}
    </Link>
  );
}
