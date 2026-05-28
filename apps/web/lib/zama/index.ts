"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { RealZamaProvider, type RealZamaProviderOptions } from "./real-provider";
import type { ZamaProvider, ZamaStatus } from "./types";

export function createZamaProvider(opts: RealZamaProviderOptions): ZamaProvider {
  return new RealZamaProvider(opts);
}

export function useZama() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [status, setStatus] = useState<ZamaStatus | null>(null);

  const provider = useMemo(
    () =>
      createZamaProvider({
        publicClient,
        walletClient,
        account: address,
      }),
    [publicClient, walletClient, address],
  );

  useEffect(() => {
    let active = true;
    provider
      .getStatus()
      .then((s) => active && setStatus(s))
      .catch(
        () =>
          active &&
          setStatus({
            mode: "real",
            ready: false,
            message: "Zama provider error.",
          }),
      );
    return () => {
      active = false;
    };
  }, [provider]);

  return { provider, status, mode: "real" as const };
}

export * from "./types";
export { RealZamaProvider } from "./real-provider";
