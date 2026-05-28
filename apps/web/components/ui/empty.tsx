import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cloak-line bg-ink-900/40 px-6 py-12 text-center">
      {icon ? <div className="mb-3 text-cloak-faint">{icon}</div> : null}
      <p className="text-sm font-medium text-cloak-fg">{title}</p>
      {description ? (
        <p className="mt-1 max-w-sm text-xs text-cloak-muted">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-cloak-line pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gold">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-cloak-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
