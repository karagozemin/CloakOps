import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("card-pad", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-cloak-line px-5 py-4 sm:px-6">
      <div className="flex items-start gap-3">
        {icon ? <div className="mt-0.5 text-gold">{icon}</div> : null}
        <div>
          <h3 className="text-sm font-semibold text-cloak-fg">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-cloak-muted">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
