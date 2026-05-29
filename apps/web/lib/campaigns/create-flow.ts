import type { Address } from "viem";
import type { ParsedRecipient } from "@/lib/csv/parse";
import type { ZamaProvider } from "@/lib/zama/types";
import { tokenOpsVestingLink, tokenOpsVestingToken } from "@/lib/config";
import { hasLiveContract } from "@/lib/contracts";
import type { OnChainClients } from "@/lib/wagmi/on-chain-clients";
export type { OnChainClients } from "@/lib/wagmi/on-chain-clients";
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

export interface RunCreateCampaignArgs {
  input: CreateCampaignInput;
  recipients: ParsedRecipient[];
  zama: ZamaProvider;
  tokenops: TokenOpsBridge;
  contractAddress: string;
  onStep: (key: FlowStepKey, status: FlowStepStatus, detail?: string) => void;
  onChain: OnChainClients;
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

  if (!hasLiveContract) {
    throw new Error("NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS is not configured.");
  }

  onStep("parse", "done", `${recipients.length} recipients validated.`);

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
      `${recipients.length} allocations encrypted with Zama FHE.`,
    );
  } catch (err) {
    onStep("encrypt", "error", errMsg(err));
    throw err;
  }

  onStep(
    "submit",
    "active",
    "Confirm campaign creation in your wallet…",
  );
  let id: string;
  let onChainId: number;
  let txHash: string;

  let campaignId: bigint;
  try {
    ({ campaignId } = await createCampaignOnChain(
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
    ));
    onChainId = Number(campaignId);
    id = String(onChainId);
    onStep(
      "submit",
      "done",
      `Campaign #${onChainId} created on Sepolia.`,
    );
  } catch (err) {
    onStep("submit", "error", errMsg(err));
    throw err;
  }

  onStep(
    "tokenops",
    "active",
    "Confirm encrypted recipient batch in your wallet…",
  );
  try {
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
    txHash = addHash;
  } catch (err) {
    onStep("tokenops", "error", errMsg(err));
    throw err;
  }

  // TokenOps confidential vesting: deploy + fund a vesting wallet per stakeholder
  // on TokenOps' on-chain factory. This is the canonical "real integration" step,
  // so a revert here is fatal — the campaign creator must hold a confidential
  // balance of the vesting token (the factory pulls it via confidentialTransferFrom).
  let tokenOpsResult: TokenOpsCampaignResult;
  try {
    onStep("tokenops", "active", "Connecting to TokenOps vesting factory…");
    tokenOpsResult = await tokenops.createCampaign({
      name: input.name,
      campaignType: input.campaignType,
      totalBudget: input.totalBudget,
      token: input.tokenAddress,
      vestingToken: tokenOpsVestingToken(input.tokenAddress),
      admin: input.admin,
      claimStart: input.claimStart,
      claimEnd: input.claimEnd,
      recipientCount: recipients.length,
      cloakOpsCampaignId: id,
      onChain,
    });

    onStep(
      "tokenops",
      "active",
      "Mint test balance, approve operator, then confirm confidential vesting funding…",
    );
    await tokenops.syncRecipients({
      tokenOpsCampaignId: tokenOpsResult.tokenOpsCampaignId,
      token: tokenOpsVestingToken(input.tokenAddress),
      claimStart: input.claimStart,
      claimEnd: input.claimEnd,
      recipients: recipients.map((r) => ({
        wallet: r.wallet,
        allocation: r.allocation,
        vestingClass: r.vestingClass,
      })),
      onChain,
    });

    await tokenops.createDistributionOperation({
      tokenOpsCampaignId: tokenOpsResult.tokenOpsCampaignId,
      rail: "confidential",
      recipientCount: recipients.length,
    });
    onStep("tokenops", "done", "Stakeholders funded on TokenOps confidential vesting.");
  } catch (err) {
    onStep("tokenops", "error", errMsg(err));
    throw err;
  }

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
    tokenOpsCampaignId:
      tokenOpsResult.tokenOpsCampaignId ??
      tokenOpsResult.managerAddress ??
      tokenOpsVestingLink()?.id,
    tokenOpsUrl: tokenOpsResult.url ?? tokenOpsVestingLink()?.url,
    notes: input.notes,
    source: "onchain",
  };
  campaignStore.upsert(record);
  onStep("ready", "done", "Campaign live on Sepolia.");

  return record;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
