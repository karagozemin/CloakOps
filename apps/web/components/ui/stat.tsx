import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-cloak-line bg-ink-900/50 p-4", className)}>
      <div className="flex items-center gap-2">
        {icon ? <span className="text-cloak-muted">{icon}</span> : null}
        <p className="label">{label}</p>
      </div>
      <p className="mt-1.5 text-xl font-semibold tracking-tight text-cloak-fg">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-cloak-muted">{hint}</p> : null}
    </div>
  );
}
