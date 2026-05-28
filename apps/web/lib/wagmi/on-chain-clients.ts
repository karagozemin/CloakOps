import { getWalletClient, switchChain } from "@wagmi/core";
import type { Address, PublicClient, WalletClient } from "viem";
import { sepolia } from "viem/chains";
import { wagmiConfig } from "@/lib/wagmi";

export interface OnChainClients {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Address;
}

/**
 * Resolve a viem WalletClient for contract writes. `useWalletClient()` often
 * returns undefined while `isConnected` is already true — use this before txs.
 */
export async function resolveOnChainClients(
  account: Address,
  publicClient: PublicClient,
): Promise<OnChainClients> {
  let client;
  try {
    client = await getWalletClient(wagmiConfig, { account });
  } catch {
    await switchChain(wagmiConfig, { chainId: sepolia.id });
    client = await getWalletClient(wagmiConfig, { account });
  }

  if (!client) {
    throw new Error(
      "Could not get a wallet client. Reconnect your wallet on Sepolia and retry.",
    );
  }

  return {
    walletClient: client as unknown as WalletClient,
    publicClient,
    account,
  };
}
