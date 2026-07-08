"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Wallet } from "lucide-react";
import { useAccount, useSwitchChain } from "wagmi";
import { toFriendlyError } from "@/lib/errors";
import { CHAIN_ID } from "@/lib/config";
import { ConnectButton } from "@/components/connect-button";
import { cn } from "@/lib/utils";

/**
 * Inline, actionable error box shared across admin / claim / public-audit.
 *
 * - Classifies the raw error into a friendly message.
 * - Renders the right call-to-action (switch network, connect wallet).
 * - Keeps the raw error behind a "Details" disclosure for debugging.
 */
export function ErrorNotice({
  error,
  context,
  className,
}: {
  error: unknown;
  context?: "decrypt" | "tx";
  className?: string;
}) {
  const [showRaw, setShowRaw] = useState(false);
  if (!error) return null;

  const friendly = toFriendlyError(error, context);
  const hasRaw = friendly.raw && friendly.raw !== friendly.message;

  return (
    <div
      className={cn(
        "rounded-lg border border-cloak-danger/30 bg-cloak-danger/10 p-3",
        className,
      )}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-cloak-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-cloak-danger">
            {friendly.message}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {friendly.kind === "wrong-network" ? <SwitchNetworkButton /> : null}
            {friendly.kind === "not-connected" ? <ConnectButton /> : null}
            {hasRaw ? (
              <button
                type="button"
                onClick={() => setShowRaw((v) => !v)}
                className="inline-flex items-center gap-1 text-[11px] text-cloak-muted hover:text-cloak-fg"
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    showRaw && "rotate-180",
                  )}
                />
                Details
              </button>
            ) : null}
          </div>

          {showRaw && hasRaw ? (
            <pre className="mono mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-ink-900 p-2 text-[10px] leading-relaxed text-cloak-muted">
              {friendly.raw}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Button that asks the wallet to switch to the configured chain (Sepolia). */
export function SwitchNetworkButton({ className }: { className?: string }) {
  const { isConnected } = useAccount();
  const { switchChain, isPending } = useSwitchChain();

  if (!isConnected) return <ConnectButton />;

  return (
    <button
      type="button"
      className={cn("btn-subtle", className)}
      disabled={isPending}
      onClick={() => switchChain({ chainId: CHAIN_ID as 11155111 })}
    >
      <Wallet className="h-3.5 w-3.5" />
      {isPending ? "Switching…" : "Switch to Sepolia"}
    </button>
  );
}

/**
 * Persistent banner shown at the top of interactive pages when the connected
 * wallet is on the wrong network. Returns null when everything is fine.
 */
export function WrongNetworkBanner({ className }: { className?: string }) {
  const { isConnected, chainId } = useAccount();
  if (!isConnected || chainId === CHAIN_ID) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-cloak-warn/30 bg-cloak-warn/10 p-3",
        className,
      )}
    >
      <p className="flex items-center gap-2 text-xs text-cloak-warn">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Your wallet is on the wrong network. CloakOps runs on Sepolia.
      </p>
      <SwitchNetworkButton />
    </div>
  );
}
