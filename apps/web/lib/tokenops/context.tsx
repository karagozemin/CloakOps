"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { CHAIN_ID } from "@/lib/config";
import { createTokenOpsAdapter } from "./index";
import type {
  CreateDistributionOperationInput,
  CreateTokenOpsCampaignInput,
  DistributionOperationResult,
  SyncRecipientsInput,
  SyncRecipientsResult,
  TokenOpsCampaignResult,
  TokenOpsLogEntry,
  TokenOpsLogger,
  TokenOpsStatus,
} from "./types";

interface TokenOpsContextValue {
  mode: "real";
  status: TokenOpsStatus | null;
  statusLoading: boolean;
  log: TokenOpsLogEntry[];
  refreshStatus: () => Promise<void>;
  createCampaign: (
    input: CreateTokenOpsCampaignInput,
  ) => Promise<TokenOpsCampaignResult>;
  syncRecipients: (input: SyncRecipientsInput) => Promise<SyncRecipientsResult>;
  createDistributionOperation: (
    input: CreateDistributionOperationInput,
  ) => Promise<DistributionOperationResult>;
}

const TokenOpsContext = createContext<TokenOpsContextValue | null>(null);

let logSeq = 0;

export function TokenOpsProvider({ children }: { children: ReactNode }) {
  const mode = "real" as const;
  const [status, setStatus] = useState<TokenOpsStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [log, setLog] = useState<TokenOpsLogEntry[]>([]);

  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const pushLog = useCallback<TokenOpsLogger>((entry) => {
    setLog((prev) =>
      [
        {
          id: `log_${++logSeq}`,
          ts: Date.now(),
          ...entry,
        },
        ...prev,
      ].slice(0, 60),
    );
  }, []);

  // Recreate the adapter when wallet/clients change.
  const adapterRef = useRef(
    createTokenOpsAdapter({ chainId: CHAIN_ID, onLog: pushLog }),
  );
  useEffect(() => {
    adapterRef.current = createTokenOpsAdapter({
      chainId: CHAIN_ID,
      onLog: pushLog,
      publicClient: publicClient as never,
      walletClient: walletClient as never,
      account: address,
    });
  }, [pushLog, publicClient, walletClient, address]);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      const next = await adapterRef.current.getStatus();
      setStatus(next);
    } catch (err) {
      pushLog({
        level: "error",
        op: "status",
        message: err instanceof Error ? err.message : "Status probe failed.",
      });
    } finally {
      setStatusLoading(false);
    }
  }, [pushLog]);

  useEffect(() => {
    void refreshStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCampaign = useCallback(
    (input: CreateTokenOpsCampaignInput) =>
      adapterRef.current.createCampaign(input),
    [],
  );
  const syncRecipients = useCallback(
    (input: SyncRecipientsInput) => adapterRef.current.syncRecipients(input),
    [],
  );
  const createDistributionOperation = useCallback(
    (input: CreateDistributionOperationInput) =>
      adapterRef.current.createDistributionOperation(input),
    [],
  );

  const value = useMemo<TokenOpsContextValue>(
    () => ({
      mode,
      status,
      statusLoading,
      log,
      refreshStatus,
      createCampaign,
      syncRecipients,
      createDistributionOperation,
    }),
    [
      mode,
      status,
      statusLoading,
      log,
      refreshStatus,
      createCampaign,
      syncRecipients,
      createDistributionOperation,
    ],
  );

  return (
    <TokenOpsContext.Provider value={value}>
      {children}
    </TokenOpsContext.Provider>
  );
}

export function useTokenOps(): TokenOpsContextValue {
  const ctx = useContext(TokenOpsContext);
  if (!ctx) {
    throw new Error("useTokenOps must be used within <TokenOpsProvider>.");
  }
  return ctx;
}
