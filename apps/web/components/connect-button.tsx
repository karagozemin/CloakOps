"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useState } from "react";
import { ChevronDown, LogOut, Wallet } from "lucide-react";
import { shortAddress } from "@/lib/utils";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const [open, setOpen] = useState(false);

  if (isConnected && address) {
    return (
      <div className="relative">
        <button
          className="btn-ghost"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
        >
          <span className="h-2 w-2 rounded-full bg-cloak-ok" />
          <span className="mono text-xs">{shortAddress(address)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-cloak-muted" />
        </button>
        {open ? (
          <div
            className="absolute right-0 z-50 mt-2 w-44 rounded-lg border border-cloak-line bg-ink-850 p-1 shadow-card"
            role="menu"
          >
            <button
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-cloak-fg hover:bg-ink-700"
              onClick={() => {
                disconnect();
                setOpen(false);
              }}
            >
              <LogOut className="h-3.5 w-3.5" />
              Disconnect
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const injectedConnector = connectors[0];

  return (
    <button
      className="btn-primary"
      disabled={isPending || !injectedConnector}
      onClick={() => injectedConnector && connect({ connector: injectedConnector })}
    >
      <Wallet className="h-4 w-4" />
      {isPending ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
