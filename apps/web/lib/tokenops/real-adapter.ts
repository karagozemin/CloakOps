import {
  TOKENOPS_VESTING_CONTRACT,
  tokenOpsDashboardUrl,
  tokenOpsVestingToken,
} from "@/lib/config";
import type { Address, PublicClient, WalletClient } from "viem";
import {
  buildVestingParams,
  campaignManagerSalt,
  ensureTokenOperator,
  resolveTokenOpsRelayerUrl,
} from "./vesting-helpers";
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

export interface RealTokenOpsAdapterOptions extends TokenOpsAdapterOptions {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  account?: Address;
}

/**
 * RealTokenOpsAdapter — `@tokenops/sdk/fhe-vesting` on Sepolia.
 *
 * createCampaign  → reuse configured manager or deploy a new clone
 * syncRecipients  → setOperator + batchCreateVesting (encrypted amounts)
 * createDistributionOperation → verify on-chain recipient count
 */
export class RealTokenOpsAdapter implements TokenOpsCampaignAdapter {
  readonly mode = "real" as const;
  private readonly chainId: number;
  private readonly log: TokenOpsLogger;
  private readonly publicClient?: PublicClient;
  private readonly walletClient?: WalletClient;
  private readonly account?: Address;

  constructor(opts: RealTokenOpsAdapterOptions) {
    this.chainId = opts.chainId;
    this.log = opts.onLog ?? (() => {});
    this.publicClient = opts.publicClient;
    this.walletClient = opts.walletClient;
    this.account = opts.account;
  }

  async getStatus(): Promise<TokenOpsStatus> {
    const start = Date.now();
    try {
      const { getFheVestingFactoryAddress } = await import("@tokenops/sdk");
      const factoryAddress = getFheVestingFactoryAddress(this.chainId);
      const managerAddress = TOKENOPS_VESTING_CONTRACT || undefined;
      const chainSupported = Boolean(factoryAddress);

      const status: TokenOpsStatus = {
        mode: "real",
        connected: chainSupported,
        provider: "@tokenops/sdk fhe-vesting (ERC-7984)",
        sdkVersion: "1.x",
        chainId: this.chainId,
        chainSupported,
        factoryAddress,
        managerAddress,
        message: chainSupported
          ? managerAddress
            ? `TokenOps vesting manager ${managerAddress.slice(0, 10)}… on Sepolia.`
            : `TokenOps vesting factory resolved on chain ${this.chainId}.`
          : `TokenOps SDK loaded, but no vesting factory is deployed on chain ${this.chainId}.`,
        latencyMs: Date.now() - start,
        capabilities: [
          "createCampaign",
          "syncRecipients",
          "createDistributionOperation:confidential",
        ],
      };
      this.log({
        level: chainSupported ? "success" : "warn",
        op: "status",
        message: status.message,
        meta: { factory: factoryAddress, manager: managerAddress },
      });
      return status;
    } catch (err) {
      const message = "Failed to load @tokenops/sdk.";
      this.log({ level: "error", op: "status", message: errToString(err) });
      return {
        mode: "real",
        connected: false,
        provider: "@tokenops/sdk (load failed)",
        chainId: this.chainId,
        chainSupported: false,
        message,
        latencyMs: Date.now() - start,
        capabilities: [],
      };
    }
  }

  async createCampaign(
    input: CreateTokenOpsCampaignInput,
  ): Promise<TokenOpsCampaignResult> {
    const publicClient = input.onChain?.publicClient ?? this.publicClient;
    const walletClient = input.onChain?.walletClient ?? this.walletClient;
    const account = input.onChain?.account ?? this.account;

    if (!publicClient) {
      throw new TokenOpsRealModeError(
        "Connect a wallet on Sepolia to sync with TokenOps.",
      );
    }

    const existingManager = TOKENOPS_VESTING_CONTRACT;
    if (existingManager) {
      this.log({
        level: "success",
        op: "createCampaign",
        message: `Using TokenOps vesting manager ${existingManager.slice(0, 10)}…`,
        meta: { manager: existingManager, cloakOpsCampaignId: input.cloakOpsCampaignId },
      });
      return {
        tokenOpsCampaignId: existingManager,
        managerAddress: existingManager,
        status: "created",
        createdAt: Date.now(),
        url: tokenOpsDashboardUrl(existingManager),
      };
    }

    if (!walletClient || !account) {
      throw new TokenOpsRealModeError(
        "Deploying a new TokenOps vesting manager requires a connected wallet.",
      );
    }

    const vestingToken = (input.vestingToken ?? tokenOpsVestingToken() ?? input.token) as Address;

    this.log({
      level: "info",
      op: "createCampaign",
      message: `Deploying TokenOps vesting manager for "${input.name}"…`,
    });

    const { createConfidentialVestingFactoryClient } = await import(
      "@tokenops/sdk/fhe-vesting"
    );

    const factory = createConfidentialVestingFactoryClient({
      publicClient,
      walletClient,
      chainId: this.chainId,
    });

    const userSalt = campaignManagerSalt(input.cloakOpsCampaignId);
    const { hash, manager } = await factory.createManager({
      token: vestingToken,
      userSalt,
      account,
    });

    this.log({
      level: "success",
      op: "createCampaign",
      message: `Vesting manager deployed at ${manager.slice(0, 10)}…`,
      meta: { txHash: hash, manager },
    });

    return {
      tokenOpsCampaignId: manager,
      managerAddress: manager,
      status: "created",
      createdAt: Date.now(),
      url: tokenOpsDashboardUrl(manager),
      txHash: hash,
    };
  }

  async syncRecipients(
    input: SyncRecipientsInput,
  ): Promise<SyncRecipientsResult> {
    const publicClient = input.onChain?.publicClient ?? this.publicClient;
    const walletClient = input.onChain?.walletClient ?? this.walletClient;
    const account = input.onChain?.account ?? this.account;

    if (!publicClient || !walletClient || !account) {
      throw new TokenOpsRealModeError(
        "Connect your wallet to register stakeholders on TokenOps.",
      );
    }
    if (input.recipients.length === 0) {
      return {
        tokenOpsCampaignId: input.tokenOpsCampaignId,
        synced: 0,
        status: "synced",
      };
    }

    const manager = input.tokenOpsCampaignId as Address;
    const token = (input.token ?? tokenOpsVestingToken()) as Address;

    this.log({
      level: "info",
      op: "syncRecipients",
      message: `Authorising TokenOps manager to spend confidential tokens…`,
    });

    const operatorHash = await ensureTokenOperator(
      token,
      manager,
      walletClient,
      publicClient,
      account,
    );

    this.log({
      level: "success",
      op: "syncRecipients",
      message: `Operator approved (tx ${operatorHash.slice(0, 10)}…).`,
    });

    const { createSepoliaEncryptorWeb } = await import("@tokenops/sdk/fhe");
    const { createConfidentialVestingManagerClient } = await import(
      "@tokenops/sdk/fhe-vesting"
    );

    const relayerUrl = resolveTokenOpsRelayerUrl();
    const encryptor = await createSepoliaEncryptorWeb({
      publicClient,
      walletClient,
      relayerUrl,
      chainId: this.chainId,
    });

    const vestingClient = createConfidentialVestingManagerClient({
      publicClient,
      walletClient,
      address: manager,
      encryptor,
    });

    const items = input.recipients.map((r) => ({
      params: buildVestingParams(
        r.wallet as Address,
        input.claimStart,
        input.claimEnd,
        r.vestingClass,
      ),
      amount: BigInt(r.allocation),
    }));

    const maxBatch = Number(await vestingClient.maxBatchSize());
    const batchSize = Math.max(maxBatch, 1);
    let synced = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const chunk = items.slice(i, i + batchSize);
      this.log({
        level: "info",
        op: "syncRecipients",
        message: `Creating ${chunk.length} confidential vesting schedule(s) on TokenOps…`,
        meta: { batch: Math.floor(i / batchSize) + 1 },
      });

      const hash = await vestingClient.batchCreateVesting({
        items: chunk,
        encryptor,
        account,
      });

      synced += chunk.length;
      this.log({
        level: "success",
        op: "syncRecipients",
        message: `Batch ${Math.floor(i / batchSize) + 1} confirmed (${hash.slice(0, 10)}…).`,
        meta: { synced, total: items.length },
      });
    }

    return {
      tokenOpsCampaignId: input.tokenOpsCampaignId,
      synced,
      status: synced === input.recipients.length ? "synced" : "partial",
    };
  }

  async createDistributionOperation(
    input: CreateDistributionOperationInput,
  ): Promise<DistributionOperationResult> {
    const publicClient = this.publicClient;
    if (!publicClient) {
      return {
        operationId: input.tokenOpsCampaignId,
        status: "ready",
        rail: input.rail,
      };
    }

    try {
      const { createConfidentialVestingManagerClient } = await import(
        "@tokenops/sdk/fhe-vesting"
      );
      const manager = createConfidentialVestingManagerClient({
        publicClient,
        address: input.tokenOpsCampaignId as Address,
      });
      const count = Number(await manager.getAllRecipientsLength());

      this.log({
        level: "success",
        op: "distribution",
        message: `TokenOps vesting manager holds ${count} stakeholder(s).`,
        meta: { recipients: count },
      });
    } catch (err) {
      this.log({
        level: "warn",
        op: "distribution",
        message: errToString(err),
      });
    }

    return {
      operationId: input.tokenOpsCampaignId,
      status: "ready",
      rail: input.rail,
    };
  }

  async getAnalytics(campaignId: string): Promise<TokenOpsAnalytics> {
    const publicClient = this.publicClient;
    if (!publicClient) {
      return emptyAnalytics(campaignId);
    }

    try {
      const { createConfidentialVestingManagerClient } = await import(
        "@tokenops/sdk/fhe-vesting"
      );
      const manager = createConfidentialVestingManagerClient({
        publicClient,
        address: campaignId as Address,
      });
      const recipients = Number(await manager.getAllRecipientsLength());

      return {
        tokenOpsCampaignId: campaignId,
        recipients,
        claimed: 0,
        pending: recipients,
        totalBudget: "0",
      };
    } catch {
      return emptyAnalytics(campaignId);
    }
  }
}

export class TokenOpsRealModeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TokenOpsRealModeError";
  }
}

function emptyAnalytics(campaignId: string): TokenOpsAnalytics {
  return {
    tokenOpsCampaignId: campaignId,
    recipients: 0,
    claimed: 0,
    pending: 0,
    totalBudget: "0",
  };
}

function errToString(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
