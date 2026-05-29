"use client";

import { cn } from "@/lib/utils";

export function SectionBackground({
  children,
  className,
  opacity = 1,
  variant = "section",
  fullBleed = false,
}: {
  children: React.ReactNode;
  className?: string;
  opacity?: number;
  variant?: "section" | "viewport";
  fullBleed?: boolean;
}) {
  return (
    <div
      className={cn(
        "pointer-events-none overflow-hidden",
        variant === "viewport"
          ? "fixed inset-0 z-0 h-[100dvh] w-screen"
          : fullBleed
            ? "absolute inset-y-0 left-1/2 -z-10 w-screen -translate-x-1/2"
            : "absolute inset-0 -z-10",
        className,
      )}
      style={{ opacity }}
      aria-hidden
    >
      {children}
    </div>
  );
}
