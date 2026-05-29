"use client";

import { cn } from "@/lib/utils";

export function SectionBackground({
  children,
  className,
  opacity = 1,
}: {
  children: React.ReactNode;
  className?: string;
  opacity?: number;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className,
      )}
      style={{ opacity }}
      aria-hidden
    >
      {children}
    </div>
  );
}
