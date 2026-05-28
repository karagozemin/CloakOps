"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { ZAMA_MODE } from "@/lib/config";
import { DemoZamaProvider } from "./demo-provider";
import { RealZamaProvider, type RealZamaProviderOptions } from "./real-provider";
import type { ZamaMode, ZamaProvider, ZamaStatus } from "./types";

export function createZamaProvider(
  mode: ZamaMode,
  opts: RealZamaProviderOptions,
): ZamaProvider {
  if (mode === "real") {
    return new RealZamaProvider(opts);
  }
  return new DemoZamaProvider();
}

export function useZama() {
  const mode = ZAMA_MODE;
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [status, setStatus] = useState<ZamaStatus | null>(null);

  const provider = useMemo(
    () =>
      createZamaProvider(mode, {
        publicClient,
        walletClient,
        account: address,
      }),
    [mode, publicClient, walletClient, address],
  );

  useEffect(() => {
    let active = true;
    provider
      .getStatus()
      .then((s) => active && setStatus(s))
      .catch(() => active && setStatus({ mode, ready: false, message: "Zama provider error." }));
    return () => {
      active = false;
    };
  }, [provider, mode]);

  return { provider, status, mode };
}

export * from "./types";
export { DemoZamaProvider } from "./demo-provider";
export { RealZamaProvider } from "./real-provider";
