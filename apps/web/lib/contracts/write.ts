import type { Address, Hash, PublicClient, WalletClient } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { getContractConfig } from "@/lib/contracts";

export interface CreateOnChainCampaignInput {
  name: string;
  metadataURI: string;
  campaignType: number;
  totalBudget: bigint;
  claimStart: bigint;
  claimEnd: bigint;
  token: Address;
}

export interface BatchRecipientsOnChainInput {
  campaignId: bigint;
  wallets: Address[];
  amountHandles: `0x${string}`[];
  tierHandles: `0x${string}`[];
  vestingHandles: `0x${string}`[];
  inputProof: `0x${string}`;
}

function requireConfig() {
  const cfg = getContractConfig();
  if (!cfg) throw new Error("NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS is not set.");
  return cfg;
}

export async function createCampaignOnChain(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  input: CreateOnChainCampaignInput,
): Promise<{ hash: Hash; campaignId: bigint }> {
  const cfg = requireConfig();
  const hash = await walletClient.writeContract({
    ...cfg,
    functionName: "createCampaign",
    args: [
      input.name,
      input.metadataURI,
      input.campaignType,
      input.totalBudget,
      input.claimStart,
      input.claimEnd,
      input.token,
    ],
    account,
    chain: walletClient.chain,
  });

  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== "success") {
    throw new Error("createCampaign transaction reverted.");
  }

  const campaignCount = await publicClient.readContract({
    ...cfg,
    functionName: "campaignCount",
  });

  return { hash, campaignId: campaignCount as bigint };
}

export async function batchAddRecipientsOnChain(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  input: BatchRecipientsOnChainInput,
): Promise<Hash> {
  const cfg = requireConfig();
  const hash = await walletClient.writeContract({
    ...cfg,
    functionName: "batchAddRecipients",
    args: [
      input.campaignId,
      input.wallets,
      input.amountHandles,
      input.tierHandles,
      input.vestingHandles,
      input.inputProof,
    ],
    account,
    chain: walletClient.chain,
  });

  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== "success") {
    throw new Error("batchAddRecipients transaction reverted.");
  }
  return hash;
}

export async function claimOnChain(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  campaignId: bigint,
): Promise<Hash> {
  const cfg = requireConfig();
  const hash = await walletClient.writeContract({
    ...cfg,
    functionName: "claim",
    args: [campaignId],
    account,
    chain: walletClient.chain,
  });
  const receipt = await waitForTransactionReceipt(publicClient, { hash });
  if (receipt.status !== "success") {
    throw new Error("claim transaction reverted.");
  }
  return hash;
}
