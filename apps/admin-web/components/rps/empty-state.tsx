import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed p-10 text-center">
      {Icon && <Icon className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden />}
      <div className="text-body font-medium">{title}</div>
      {body && <p className="mx-auto mt-1 max-w-sm text-small text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
