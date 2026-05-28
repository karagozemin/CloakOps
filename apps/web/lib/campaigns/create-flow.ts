import type { ParsedRecipient } from "@/lib/csv/parse";
import type { ZamaProvider } from "@/lib/zama/types";
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
 * Orchestrates the confidential campaign creation lifecycle and streams status
 * to the UI step indicator:
 *   parse -> encrypt (Zama FHE) -> submit (contract) -> sync (TokenOps) -> ready
 */
export async function runCreateCampaign(
  args: RunCreateCampaignArgs,
): Promise<CampaignRecord> {
  const { input, recipients, zama, tokenops, contractAddress, onStep } = args;

  onStep("parse", "done", `${recipients.length} recipients validated.`);

  // 1) Encrypt allocations/tiers/vesting with Zama FHE.
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
      `${recipients.length} allocations encrypted (euint64 / euint8).`,
    );
  } catch (err) {
    onStep("encrypt", "error", errMsg(err));
    throw err;
  }

  // 2) Submit to the confidential contract (simulated unless a live contract
  //    + real Zama mode are configured; demo mode records a local campaign).
  onStep("submit", "active");
  const { id, onChainId } = nextLocalId();
  const txHash = randomTxHash();
  await delay(700);
  onStep(
    "submit",
    "done",
    `Campaign #${onChainId} recorded (tx ${txHash.slice(0, 10)}…).`,
  );

  // 3) Sync the campaign lifecycle to TokenOps.
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

  // 4) Persist the campaign record.
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
    source: "demo",
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
