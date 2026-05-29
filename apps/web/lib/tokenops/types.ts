/**
 * TokenOps integration types.
 *
 * CloakOps treats TokenOps as the *campaign / distribution lifecycle rail*.
 * The confidential allocation/tier/vesting metadata layer is owned by the Zama
 * FHE contract (ConfidentialCampaign.sol). The adapter below never receives
 * plaintext per-recipient allocations from the confidential layer — only the
 * data a distribution rail legitimately needs (campaign metadata + recipient
 * addresses + counts).
 */

export type TokenOpsMode = "real";

export interface TokenOpsStatus {
  mode: TokenOpsMode;
  connected: boolean;
  /** Human label for the active provider. */
  provider: string;
  sdkVersion?: string;
  chainId: number;
  chainSupported: boolean;
  /** Resolved on-chain confidential-vesting factory address. */
  factoryAddress?: string;
  /** Short status message for the UI. */
  message: string;
  /** Round-trip latency in ms for the status probe. */
  latencyMs?: number;
  capabilities: string[];
}

export interface TokenOpsOnChainClients {
  walletClient: import("viem").WalletClient;
  publicClient: import("viem").PublicClient;
  account: import("viem").Address;
}

export interface CreateTokenOpsCampaignInput {
  name: string;
  campaignType: number;
  /** Public, headline budget (already disclosed). */
  totalBudget: string;
  token: string;
  admin: string;
  claimStart: number;
  claimEnd: number;
  recipientCount: number;
  /** Reference to the on-chain CloakOps campaign once it exists. */
  cloakOpsCampaignId?: string;
  /** ERC-7984 token the vesting factory pulls. Defaults to `token`. */
  vestingToken?: string;
  /** Wallet clients from the create flow (wagmi `useWalletClient` can lag behind `isConnected`). */
  onChain?: TokenOpsOnChainClients;
}

export interface TokenOpsCampaignResult {
  tokenOpsCampaignId: string;
  status: "created" | "draft" | "pending";
  createdAt: number;
  /** Link into the TokenOps dashboard (when available). */
  url?: string;
  /** Tx hash when a real on-chain factory call was made. */
  txHash?: string;
}

/** Recipient row synced into TokenOps confidential vesting (amounts encrypted client-side). */
export interface TokenOpsRecipientEntry {
  wallet: string;
  allocation: number;
  vestingClass: number;
}

export interface SyncRecipientsInput {
  /** Vesting factory address from {@link TokenOpsCampaignResult}. */
  tokenOpsCampaignId: string;
  token: string;
  claimStart: number;
  claimEnd: number;
  recipients: TokenOpsRecipientEntry[];
  onChain?: TokenOpsOnChainClients;
}

export interface SyncRecipientsResult {
  tokenOpsCampaignId: string;
  synced: number;
  status: "synced" | "partial";
  /** Confidential funding tx hash — the verifiable on-chain proof. */
  txHash?: string;
}

export interface CreateDistributionOperationInput {
  tokenOpsCampaignId: string;
  /** "confidential" = ERC-7984 confidential rail; "standard" = plaintext rail. */
  rail: "confidential" | "standard";
  recipientCount: number;
}

export interface DistributionOperationResult {
  operationId: string;
  status: "queued" | "ready" | "executing";
  rail: "confidential" | "standard";
}

export type TokenOpsLogLevel = "info" | "success" | "warn" | "error";

export interface TokenOpsLogEntry {
  id: string;
  ts: number;
  level: TokenOpsLogLevel;
  op: string;
  message: string;
  meta?: Record<string, string | number | undefined>;
}

export type TokenOpsLogger = (
  entry: Omit<TokenOpsLogEntry, "id" | "ts">,
) => void;

export interface TokenOpsAdapterOptions {
  chainId: number;
  onLog?: TokenOpsLogger;
}

/** The contract every TokenOps adapter must implement. */
export interface TokenOpsCampaignAdapter {
  readonly mode: TokenOpsMode;
  getStatus(): Promise<TokenOpsStatus>;
  createCampaign(
    input: CreateTokenOpsCampaignInput,
  ): Promise<TokenOpsCampaignResult>;
  syncRecipients(input: SyncRecipientsInput): Promise<SyncRecipientsResult>;
  createDistributionOperation(
    input: CreateDistributionOperationInput,
  ): Promise<DistributionOperationResult>;
}
