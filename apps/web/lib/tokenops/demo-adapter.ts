import { tokenOpsVestingLink } from "@/lib/config";
import { sleep } from "@/lib/utils";
import type {
  CreateDistributionOperationInput,
  CreateTokenOpsCampaignInput,
  DistributionOperationResult,
  SyncRecipientsInput,
  SyncRecipientsResult,
  TokenOpsAdapterOptions,
  TokenOpsAnalytics,
  TokenOpsCampaignAdapter,
  TokenOpsCampaignResult,
  TokenOpsLogger,
  TokenOpsStatus,
} from "./types";

const SUPPORTED = new Set([11155111, 1, 31337]);

/**
 * DemoTokenOpsAdapter
 *
 * A faithful simulation of the TokenOps confidential-distribution lifecycle.
 * It mirrors the exact shape of the real `@tokenops/sdk` fhe-airdrop flow
 * (create campaign -> sync recipients -> create distribution operation) so the
 * demo is honest about what TokenOps does, while never requiring API keys,
 * funded wallets, or a deployed factory. This is the default mode.
 */
export class DemoTokenOpsAdapter implements TokenOpsCampaignAdapter {
  readonly mode = "demo" as const;
  private readonly chainId: number;
  private readonly log: TokenOpsLogger;

  constructor(opts: TokenOpsAdapterOptions) {
    this.chainId = opts.chainId;
    this.log = opts.onLog ?? (() => {});
  }

  async getStatus(): Promise<TokenOpsStatus> {
    const start = Date.now();
    await sleep(420);
    const status: TokenOpsStatus = {
      mode: "demo",
      connected: true,
      provider: "TokenOps demo adapter (mirrors @tokenops/sdk)",
      sdkVersion: "demo",
      chainId: this.chainId,
      chainSupported: SUPPORTED.has(this.chainId),
      message: "Demo adapter online — confidential campaign lifecycle simulated.",
      latencyMs: Date.now() - start,
      capabilities: [
        "createCampaign",
        "syncRecipients",
        "createDistributionOperation:confidential",
        "getAnalytics",
      ],
    };
    this.log({
      level: "success",
      op: "status",
      message: "Connected to TokenOps (demo mode).",
      meta: { chainId: this.chainId },
    });
    return status;
  }

  async createCampaign(
    input: CreateTokenOpsCampaignInput,
  ): Promise<TokenOpsCampaignResult> {
    this.log({
      level: "info",
      op: "createCampaign",
      message: `Creating TokenOps campaign "${input.name}"…`,
    });
    await sleep(700);
    const vesting = tokenOpsVestingLink();
    const id = vesting?.id ?? `vesting_${Math.random().toString(36).slice(2, 10)}`;
    this.log({
      level: "success",
      op: "createCampaign",
      message: vesting
        ? `Linked to TokenOps vesting schedule (${id}).`
        : `TokenOps vesting sync recorded (${id}).`,
      meta: { recipients: input.recipientCount, budget: input.totalBudget },
    });
    return {
      tokenOpsCampaignId: id,
      status: "created",
      createdAt: Date.now(),
      url: vesting?.url,
    };
  }

  async syncRecipients(
    input: SyncRecipientsInput,
  ): Promise<SyncRecipientsResult> {
    this.log({
      level: "info",
      op: "syncRecipients",
      message: `Syncing ${input.recipients.length} recipients to TokenOps…`,
    });
    await sleep(600);
    this.log({
      level: "success",
      op: "syncRecipients",
      message: `Synced ${input.recipients.length} recipients (addresses only, allocations stay encrypted).`,
    });
    return {
      tokenOpsCampaignId: input.tokenOpsCampaignId,
      synced: input.recipients.length,
      status: "synced",
    };
  }

  async createDistributionOperation(
    input: CreateDistributionOperationInput,
  ): Promise<DistributionOperationResult> {
    this.log({
      level: "info",
      op: "distribution",
      message: `Preparing ${input.rail} distribution operation…`,
    });
    await sleep(550);
    const operationId = `op_${Math.random().toString(36).slice(2, 10)}`;
    this.log({
      level: "success",
      op: "distribution",
      message: `Distribution operation ready (${operationId}, ${input.rail} rail).`,
    });
    return { operationId, status: "ready", rail: input.rail };
  }

  async getAnalytics(campaignId: string): Promise<TokenOpsAnalytics> {
    await sleep(300);
    return {
      tokenOpsCampaignId: campaignId,
      recipients: 0,
      claimed: 0,
      pending: 0,
      totalBudget: "0",
    };
  }
}
