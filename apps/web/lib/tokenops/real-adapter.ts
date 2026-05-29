import {
  TOKENOPS_AUTO_MINT,
  TOKENOPS_VESTING_FACTORY,
  tokenOpsDashboardUrl,
  tokenOpsVestingLink,
  tokenOpsVestingToken,
} from "@/lib/config";
import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { encodeFunctionData } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import {
  CONFIDENTIAL_TEST_TOKEN_ABI,
  MULTICALL3_ABI,
  MULTICALL3_ADDRESS,
  TOKENOPS_VESTING_FACTORY_ABI,
  buildVestingInitArgs,
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
 * RealTokenOpsAdapter — TokenOps confidential vesting factory on Sepolia.
 *
 * This targets `TokenOpsVestingWalletCliffExecutorConfidentialFactory`, the same
 * on-chain contract the app.tokenops.xyz dashboard deploys vesting wallets
 * through (verified: createVestingWalletConfidential + batchFund... succeed for
 * this account on Sepolia).
 *
 * createCampaign  → resolve the factory (logical campaign = factory address)
 * syncRecipients  → setOperator + createVestingWalletConfidential (per wallet)
 *                   + batchFundVestingWalletConfidential (one encrypted batch)
 * createDistributionOperation → no-op summary
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
    const factoryAddress = TOKENOPS_VESTING_FACTORY || undefined;
    const chainSupported = Boolean(factoryAddress);

    const status: TokenOpsStatus = {
      mode: "real",
      connected: chainSupported,
      provider: "TokenOps confidential vesting factory (ERC-7984)",
      sdkVersion: "1.x",
      chainId: this.chainId,
      chainSupported,
      factoryAddress,
      managerAddress: factoryAddress,
      message: chainSupported
        ? `TokenOps vesting factory ${factoryAddress!.slice(0, 10)}… on Sepolia.`
        : `No TokenOps vesting factory configured for chain ${this.chainId}.`,
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
      meta: { factory: factoryAddress },
    });
    return status;
  }

  async createCampaign(
    input: CreateTokenOpsCampaignInput,
  ): Promise<TokenOpsCampaignResult> {
    const factory = TOKENOPS_VESTING_FACTORY;
    if (!factory) {
      throw new TokenOpsRealModeError(
        "No TokenOps vesting factory is configured (NEXT_PUBLIC_TOKENOPS_VESTING_FACTORY).",
      );
    }

    this.log({
      level: "success",
      op: "createCampaign",
      message: `Using TokenOps vesting factory ${factory.slice(0, 10)}…`,
      meta: { factory, cloakOpsCampaignId: input.cloakOpsCampaignId },
    });

    return {
      tokenOpsCampaignId: factory,
      managerAddress: factory,
      status: "created",
      createdAt: Date.now(),
      url: tokenOpsDashboardUrl(factory) ?? tokenOpsVestingLink()?.url,
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

    const factory = (input.tokenOpsCampaignId as Address) || TOKENOPS_VESTING_FACTORY;
    const token = (input.token ?? tokenOpsVestingToken()) as Address;

    const totalAllocation = input.recipients.reduce(
      (sum, r) => sum + BigInt(r.allocation),
      0n,
    );

    // Build deterministic initArgs per stakeholder (executor = funder).
    const plans = input.recipients.map((r) => ({
      wallet: r.wallet as Address,
      allocation: BigInt(r.allocation),
      initArgs: buildVestingInitArgs(
        r.wallet as Address,
        input.claimStart,
        input.claimEnd,
        r.vestingClass,
        account,
      ),
    }));

    // 1. ONE signature: mint funder balance + deploy every vesting wallet clone
    //    via Multicall3. Both mint() and createVestingWalletConfidential() are
    //    independent of msg.sender, so batching through Multicall3 keeps this a
    //    single tx no matter how many stakeholders there are — while still
    //    actually deploying each clone (full functionality, not lazy).
    const calls: { target: Address; allowFailure: boolean; callData: Hex }[] = [];
    if (TOKENOPS_AUTO_MINT) {
      calls.push({
        target: token,
        allowFailure: false,
        callData: encodeFunctionData({
          abi: CONFIDENTIAL_TEST_TOKEN_ABI,
          functionName: "mint",
          args: [account, totalAllocation],
        }),
      });
    }
    for (const plan of plans) {
      calls.push({
        // allowFailure: a clone that already exists reverts — tolerate it so
        // re-runs are idempotent (the wallet is still funded below).
        target: factory,
        allowFailure: true,
        callData: encodeFunctionData({
          abi: TOKENOPS_VESTING_FACTORY_ABI,
          functionName: "createVestingWalletConfidential",
          args: [plan.initArgs],
        }),
      });
    }

    this.log({
      level: "info",
      op: "syncRecipients",
      message: `Minting balance + deploying ${plans.length} vesting wallet(s) in one tx…`,
    });
    const setupHash = await walletClient.writeContract({
      address: MULTICALL3_ADDRESS,
      abi: MULTICALL3_ABI,
      functionName: "aggregate3",
      args: [calls],
      account,
      chain: walletClient.chain,
    });
    await waitForTransactionReceipt(publicClient, { hash: setupHash });
    this.log({
      level: "success",
      op: "syncRecipients",
      message: `Balance minted + wallets deployed (tx ${setupHash.slice(0, 10)}…).`,
    });

    // 2. Authorise the factory to pull confidential tokens (skipped if already set).
    const operatorHash = await ensureTokenOperator(
      token,
      factory,
      walletClient,
      publicClient,
      account,
    );
    this.log({
      level: "success",
      op: "syncRecipients",
      message: operatorHash
        ? `Operator approved (tx ${operatorHash.slice(0, 10)}…).`
        : "Operator already approved — skipping.",
    });

    // 3. Encrypt every allocation bound to the factory + funder (single proof).
    const { createSepoliaEncryptorWeb } = await import("@tokenops/sdk/fhe");
    const { encryptUint64Batch } = await import("@tokenops/sdk/fhe-vesting");

    const encryptor = await createSepoliaEncryptorWeb({
      publicClient,
      walletClient,
      relayerUrl: resolveTokenOpsRelayerUrl(),
      chainId: this.chainId,
    });

    this.log({
      level: "info",
      op: "syncRecipients",
      message: `Encrypting ${plans.length} confidential allocation(s)…`,
    });
    const { handles, inputProof } = await encryptUint64Batch({
      encryptor,
      contractAddress: factory,
      userAddress: account,
      values: plans.map((p) => p.allocation),
    });

    // 4. Fund all vesting wallets in one confidential batch transfer.
    const vestingPlans = plans.map((p, i) => ({
      encryptedAmount: handles[i] as Hex,
      initArgs: p.initArgs,
    }));

    this.log({
      level: "info",
      op: "syncRecipients",
      message: `Funding ${plans.length} confidential vesting wallet(s)…`,
    });
    const fundHash = await walletClient.writeContract({
      address: factory,
      abi: TOKENOPS_VESTING_FACTORY_ABI,
      functionName: "batchFundVestingWalletConfidential",
      args: [token, vestingPlans, inputProof as Hex],
      account,
      chain: walletClient.chain,
    });
    await waitForTransactionReceipt(publicClient, { hash: fundHash });

    this.log({
      level: "success",
      op: "syncRecipients",
      message: `Funded ${plans.length} stakeholder(s) (tx ${fundHash.slice(0, 10)}…).`,
      meta: { synced: plans.length, txHash: fundHash },
    });

    return {
      tokenOpsCampaignId: input.tokenOpsCampaignId,
      synced: plans.length,
      status: "synced",
    };
  }

  async createDistributionOperation(
    input: CreateDistributionOperationInput,
  ): Promise<DistributionOperationResult> {
    this.log({
      level: "success",
      op: "distribution",
      message: `TokenOps confidential vesting ready for ${input.recipientCount} stakeholder(s).`,
      meta: { recipients: input.recipientCount },
    });
    return {
      operationId: input.tokenOpsCampaignId,
      status: "ready",
      rail: input.rail,
    };
  }

  async getAnalytics(campaignId: string): Promise<TokenOpsAnalytics> {
    return emptyAnalytics(campaignId);
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
