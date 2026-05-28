"use client";

import { useTokenOps } from "@/lib/tokenops/context";
import { cn } from "@/lib/utils";
import { Loader2, ShieldCheck } from "lucide-react";

export function TokenOpsStatusPill() {
  const { status, statusLoading, mode } = useTokenOps();

  const connected = status?.connected ?? false;
  const dotColor = statusLoading
    ? "bg-cloak-muted"
    : connected
      ? "bg-cloak-ok"
      : "bg-cloak-warn";

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-cloak-line bg-ink-800/80 px-3 py-1.5 text-xs"
      title={status?.message ?? "Connecting to TokenOps…"}
    >
      <ShieldCheck className="h-3.5 w-3.5 text-gold" />
      <span className="font-medium text-cloak-fg">TokenOps</span>
      <span className="text-cloak-faint">·</span>
      {statusLoading ? (
        <Loader2 className="h-3 w-3 animate-spin text-cloak-muted" />
      ) : (
        <span
          className={cn("h-1.5 w-1.5 rounded-full", dotColor)}
          aria-hidden
        />
      )}
      <span className="uppercase tracking-wide text-cloak-muted">{mode}</span>
    </div>
  );
}
