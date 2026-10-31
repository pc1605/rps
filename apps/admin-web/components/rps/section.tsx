import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  back,
  crumbs,
  mono = false,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  /** Breadcrumb trail above the title (the current page is the title itself). */
  crumbs?: { label: React.ReactNode; href?: string }[];
  mono?: boolean;
}) {
  return (
    <div className="space-y-3">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-small text-muted-foreground">
            {crumbs.map((c, i) => (
              <li key={i} className="inline-flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden />}
                {c.href ? (
                  <Link href={c.href} className="inline-flex min-h-8 items-center hover:text-foreground">
                    {c.label}
                  </Link>
                ) : (
                  <span>{c.label}</span>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      {!crumbs && back && (
        <Link
          href={back.href}
          className="inline-flex min-h-8 items-center gap-1 text-small text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className={cn("text-h1 tracking-tight", mono && "font-mono")}>{title}</h1>
          {description && <div className="mt-1 text-body text-muted-foreground">{description}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export function SectionTitle({
  id,
  children,
  aside,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-3", className)}>
      <h2 id={id} className="text-h2">
        {children}
      </h2>
      {aside && <div className="text-small text-muted-foreground">{aside}</div>}
    </div>
  );
}
