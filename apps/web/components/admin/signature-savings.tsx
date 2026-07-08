import { cn } from "@/lib/utils";
import { PenLine, Zap } from "lucide-react";

/**
 * Ceiling-breaker contrast panel.
 *
 * The single biggest operational edge CloakOps has over a naive airdrop/payroll
 * flow is that N recipients still settle in a fixed **2 signatures** (encrypt +
 * batched Multicall3 submit), instead of one signature per recipient. This panel
 * makes that contrast *visible* — the standard approach scales linearly and is
 * shown dimmed/struck-through, while CloakOps stays flat at 2 and is highlighted.
 */
export function SignatureSavings({
  recipientCount,
  className,
}: {
  recipientCount: number;
  className?: string;
}) {
  if (recipientCount <= 0) return null;

  const cloakOpsSignatures = 2;
  const saved = Math.max(recipientCount - cloakOpsSignatures, 0);
  // Cap the visual bar so huge lists don't overflow, but keep the number honest.
  const standardBar = Math.min(recipientCount, 24);

  return (
    <div
      className={cn(
        "rounded-lg border border-gold/25 bg-gold/[0.04] p-3.5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-xs font-medium text-cloak-fg">
          <Zap className="h-3.5 w-3.5 text-gold" />
          Signatures to launch
        </p>
        {saved > 0 ? (
          <span className="chip border-cloak-ok/40 text-cloak-ok">
            {saved} fewer signatures
          </span>
        ) : null}
      </div>

      <div className="mt-3 space-y-2.5">
        {/* Standard approach — scales linearly, shown dimmed + struck */}
        <div className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-[11px] leading-tight text-cloak-faint">
            Standard airdrop
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 flex-wrap gap-0.5">
              {Array.from({ length: standardBar }).map((_, i) => (
                <PenLine
                  key={i}
                  className="h-3 w-3 text-cloak-faint/50"
                  strokeWidth={2.5}
                />
              ))}
              {recipientCount > standardBar ? (
                <span className="text-[10px] text-cloak-faint/60">
                  +{recipientCount - standardBar}
                </span>
              ) : null}
            </div>
            <span className="w-24 shrink-0 text-right text-xs text-cloak-faint line-through decoration-cloak-danger/60">
              {recipientCount} signature{recipientCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* CloakOps — flat at 2, highlighted */}
        <div className="flex items-center gap-3">
          <div className="w-28 shrink-0 text-[11px] font-medium leading-tight text-gold">
            CloakOps batch
          </div>
          <div className="flex flex-1 items-center gap-2">
            <div className="flex flex-1 items-center gap-0.5">
              {Array.from({ length: cloakOpsSignatures }).map((_, i) => (
                <PenLine
                  key={i}
                  className="h-3.5 w-3.5 text-gold"
                  strokeWidth={2.5}
                />
              ))}
            </div>
            <span className="w-24 shrink-0 text-right text-xs font-semibold text-cloak-ok">
              just 2 signatures
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 border-t border-gold/15 pt-2 text-[11px] leading-relaxed text-cloak-muted">
        Encryption + submission are batched via Multicall3, so payroll for{" "}
        <span className="text-cloak-fg">{recipientCount}</span> or 400 recipients
        costs the same <span className="font-medium text-gold">two clicks</span> —
        the signature count never scales with your list.
      </p>
    </div>
  );
}
