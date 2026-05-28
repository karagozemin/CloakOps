import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Tone = "neutral" | "gold" | "ok" | "warn" | "danger" | "info";

const toneMap: Record<Tone, string> = {
  neutral: "border-cloak-line bg-ink-800 text-cloak-muted",
  gold: "border-gold/30 bg-gold/10 text-gold",
  ok: "border-cloak-ok/30 bg-cloak-ok/10 text-cloak-ok",
  warn: "border-cloak-warn/30 bg-cloak-warn/10 text-cloak-warn",
  danger: "border-cloak-danger/30 bg-cloak-danger/10 text-cloak-danger",
  info: "border-cloak-info/30 bg-cloak-info/10 text-cloak-info",
};

export function Badge({
  children,
  tone = "neutral",
  className,
  dot = false,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneMap[tone],
        className,
      )}
    >
      {dot ? (
        <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
      ) : null}
      {children}
    </span>
  );
}
