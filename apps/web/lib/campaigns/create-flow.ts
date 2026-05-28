import type { Address, PublicClient, WalletClient } from "viem";
import type { ParsedRecipient } from "@/lib/csv/parse";
import type { ZamaProvider } from "@/lib/zama/types";
import { ZAMA_MODE } from "@/lib/config";
import { hasLiveContract } from "@/lib/contracts";
import {
  batchAddRecipientsOnChain,
  createCampaignOnChain,
} from "@/lib/contracts/write";
import type {
  CreateTokenOpsCampaignInput,
  SyncRecipientsInput,
  CreateDistributionOperationInput,
  TokenOpsCampaignResult,
  SyncRecipientsResult,
  DistributionOperationResult,
} from "@/lib/tokenops/types";
import { campaignStore } from "./store";
import type { CampaignRecord } from "./types";

export type FlowStepKey =
  | "parse"
  | "encrypt"
  | "submit"
  | "tokenops"
  | "ready";

export type FlowStepStatus = "pending" | "active" | "done" | "error";

export interface CreateCampaignInput {
  name: string;
  metadataURI?: string;
  campaignType: number;
  totalBudget: string;
  tokenAddress: string;
  admin: string;
  claimStart: number;
  claimEnd: number;
  notes?: string;
}

export interface TokenOpsBridge {
  createCampaign: (
    input: CreateTokenOpsCampaignInput,
  ) => Promise<TokenOpsCampaignResult>;
  syncRecipients: (input: SyncRecipientsInput) => Promise<SyncRecipientsResult>;
  createDistributionOperation: (
    input: CreateDistributionOperationInput,
  ) => Promise<DistributionOperationResult>;
}

export interface OnChainClients {
  walletClient: WalletClient;
  publicClient: PublicClient;
  account: Address;
}

export interface RunCreateCampaignArgs {
  input: CreateCampaignInput;
  recipients: ParsedRecipient[];
  zama: ZamaProvider;
  tokenops: TokenOpsBridge;
  /** ConfidentialCampaign.sol address (not the ERC-20 token). */
  contractAddress: string;
  onStep: (key: FlowStepKey, status: FlowStepStatus, detail?: string) => void;
  onChain?: OnChainClients;
}

function nextLocalId(): { id: string; onChainId: number } {
  const all = campaignStore.list();
  const maxOnChain = all.reduce(
    (max, c) => Math.max(max, c.onChainId ?? 0),
    0,
  );
  const onChainId = maxOnChain + 1;
  return { id: String(onChainId), onChainId };
}

function randomTxHash(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Orchestrates the confidential campaign creation lifecycle:
 * parse → encrypt (Zama FHE) → submit (contract) → sync (TokenOps) → ready
 */
export async function runCreateCampaign(
  args: RunCreateCampaignArgs,
): Promise<CampaignRecord> {
  const {
    input,
    recipients,
    zama,
    tokenops,
    contractAddress,
    onStep,
    onChain,
  } = args;

  const realOnChain = ZAMA_MODE === "real" && hasLiveContract && Boolean(onChain);

  onStep("parse", "done", `${recipients.length} recipients validated.`);

  // 1) Encrypt with Zama FHE (real relayer or demo provider).
  onStep("encrypt", "active");
  let encrypted;
  try {
    encrypted = await zama.encryptBatch(
      contractAddress,
      input.admin,
      recipients,
    );
    onStep(
      "encrypt",
      "done",
      `${recipients.length} allocations encrypted (${zama.mode} mode).`,
    );
  } catch (err) {
    onStep("encrypt", "error", errMsg(err));
    throw err;
  }

  // 2) Submit to ConfidentialCampaign.sol (on-chain in real mode).
  onStep("submit", "active");
  let id: string;
  let onChainId: number;
  let txHash: string;
  let source: CampaignRecord["source"] = "demo";

  if (realOnChain && onChain) {
    try {
      const { hash, campaignId } = await createCampaignOnChain(
        onChain.walletClient,
        onChain.publicClient,
        onChain.account,
        {
          name: input.name,
          metadataURI: input.metadataURI ?? "ipfs://cloakops-campaign",
          campaignType: input.campaignType,
          totalBudget: BigInt(input.totalBudget),
          claimStart: BigInt(input.claimStart),
          claimEnd: BigInt(input.claimEnd),
          token: input.tokenAddress as Address,
        },
      );

      const addHash = await batchAddRecipientsOnChain(
        onChain.walletClient,
        onChain.publicClient,
        onChain.account,
        {
          campaignId,
          wallets: recipients.map((r) => r.wallet as Address),
          amountHandles: encrypted.recipients.map(
            (r) => r.amountHandle as `0x${string}`,
          ),
          tierHandles: encrypted.recipients.map(
            (r) => r.tierHandle as `0x${string}`,
          ),
          vestingHandles: encrypted.recipients.map(
            (r) => r.vestingHandle as `0x${string}`,
          ),
          inputProof: encrypted.inputProof as `0x${string}`,
        },
      );

      onChainId = Number(campaignId);
      id = String(onChainId);
      txHash = addHash;
      source = "onchain";
      onStep(
        "submit",
        "done",
        `Campaign #${onChainId} on Sepolia (tx ${txHash.slice(0, 10)}…).`,
      );
    } catch (err) {
      onStep("submit", "error", errMsg(err));
      throw err;
    }
  } else {
    const local = nextLocalId();
    id = local.id;
    onChainId = local.onChainId;
    txHash = randomTxHash();
    await delay(700);
    onStep(
      "submit",
      "done",
      `Campaign #${onChainId} recorded locally (demo submit).`,
    );
  }

  // 3) TokenOps lifecycle.
  onStep("tokenops", "active");
  let tokenOpsResult: TokenOpsCampaignResult;
  try {
    tokenOpsResult = await tokenops.createCampaign({
      name: input.name,
      campaignType: input.campaignType,
      totalBudget: input.totalBudget,
      token: input.tokenAddress,
      admin: input.admin,
      claimStart: input.claimStart,
      claimEnd: input.claimEnd,
      recipientCount: recipients.length,
      cloakOpsCampaignId: id,
    });
    await tokenops.syncRecipients({
      tokenOpsCampaignId: tokenOpsResult.tokenOpsCampaignId,
      recipients: recipients.map((r) => r.wallet),
    });
    await tokenops.createDistributionOperation({
      tokenOpsCampaignId: tokenOpsResult.tokenOpsCampaignId,
      rail: "confidential",
      recipientCount: recipients.length,
    });
    onStep("tokenops", "done", "Campaign synced to TokenOps.");
  } catch (err) {
    onStep("tokenops", "error", errMsg(err));
    throw err;
  }

  // 4) Persist for UI.
  onStep("ready", "active");
  const record: CampaignRecord = {
    id,
    onChainId,
    name: input.name,
    metadataURI: input.metadataURI,
    campaignType: input.campaignType,
    totalBudget: input.totalBudget,
    tokenAddress: input.tokenAddress,
    admin: input.admin,
    claimStart: input.claimStart,
    claimEnd: input.claimEnd,
    recipients: encrypted.recipients.map((r, i) => ({
      ...r,
      role: recipients[i].role,
      claimed: false,
    })),
    createdAt: Date.now(),
    txHash,
    tokenOpsCampaignId: tokenOpsResult.tokenOpsCampaignId,
    tokenOpsUrl: tokenOpsResult.url,
    notes: input.notes,
    source,
  };
  campaignStore.upsert(record);
  onStep("ready", "done", "Campaign live.");

  return record;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
