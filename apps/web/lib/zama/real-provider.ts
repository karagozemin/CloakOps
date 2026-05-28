import type { Address, PublicClient, WalletClient } from "viem";
import { CHAIN_ID } from "@/lib/config";
import type {
  BatchEncryptResult,
  EncryptedFieldType,
  RecipientPlain,
  ZamaProvider,
  ZamaStatus,
} from "./types";

/** Absolute relayer URL for the FHE web worker (relative paths break Worker fetch). */
function resolveRelayerUrl(custom?: string): string | undefined {
  if (custom?.startsWith("http")) return custom;

  const useProxy = process.env.NEXT_PUBLIC_ZAMA_USE_RELAYER_PROXY !== "false";
  if (typeof window !== "undefined" && useProxy) {
    const path = custom ?? `/api/relayer/${CHAIN_ID}`;
    return `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;
  }

  const direct =
    process.env.NEXT_PUBLIC_ZAMA_RELAYER_URL ??
    "https://relayer.testnet.zama.org/v2";
  return direct.replace(/\/$/, "");
}

export interface RealZamaProviderOptions {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  account?: Address;
  /** Backend proxy for the Zama relayer; defaults to /api/relayer/<chainId>. */
  relayerUrl?: string;
}

/** Minimal structural type for the relayer methods this provider uses. */
interface RelayerLike {
  getPublicParams(bits: number): Promise<unknown>;
  encrypt(params: {
    contractAddress: Address;
    userAddress: Address;
    values: { value: bigint; type: string }[];
  }): Promise<{ handles: Uint8Array[]; inputProof: Uint8Array }>;
  generateKeypair(): Promise<{ publicKey: `0x${string}`; privateKey: `0x${string}` }>;
  createEIP712(
    publicKey: `0x${string}`,
    contractAddresses: Address[],
    startTimestamp: number,
    durationDays?: number,
  ): Promise<{
    domain: Record<string, unknown>;
    types: Record<string, unknown>;
    message: Record<string, unknown>;
  }>;
  userDecrypt(params: Record<string, unknown>): Promise<Record<string, bigint | boolean | string>>;
}

/**
 * RealZamaProvider — uses the Zama Relayer SDK (@zama-fhe/sdk) against the
 * deployed ConfidentialCampaign contract on Sepolia. All SDK imports are
 * dynamic so the default (demo) bundle never loads the WASM relayer.
 *
 * Documented limitation (docs/privacy-model.md): real mode requires a deployed
 * contract, a relayer proxy (ZAMA_RELAYER_URL), and a connected wallet to sign
 * the EIP-712 decryption authorization. When prerequisites are missing the
 * provider raises a clear error and the UI suggests demo mode.
 */
export class RealZamaProvider implements ZamaProvider {
  readonly mode = "real" as const;
  private readonly opts: RealZamaProviderOptions;
  private relayer: RelayerLike | null = null;
  private initPromise: Promise<RelayerLike> | null = null;

  constructor(opts: RealZamaProviderOptions) {
    this.opts = opts;
  }

  async getStatus(): Promise<ZamaStatus> {
    try {
      await this.ensureRelayer();
      return {
        mode: "real",
        ready: true,
        message:
          "Zama Relayer SDK initialized for Sepolia (real encryption / user decryption).",
      };
    } catch (err) {
      return {
        mode: "real",
        ready: false,
        message:
          err instanceof Error
            ? `Relayer not ready: ${err.message}`
            : "Relayer not ready.",
      };
    }
  }

  private async ensureRelayer(): Promise<RelayerLike> {
    if (this.relayer) return this.relayer;
    if (this.initPromise) return this.initPromise;

    this.initPromise = this.initRelayer().finally(() => {
      this.initPromise = null;
    });
    return this.initPromise;
  }

  private async initRelayer(): Promise<RelayerLike> {
    if (!this.opts.publicClient) {
      throw new Error("Missing viem public client (connect a wallet on Sepolia).");
    }

    const { RelayerWeb } = await import("@zama-fhe/sdk");

    const transport: Record<string, string> = {};
    const relayerUrl = resolveRelayerUrl(this.opts.relayerUrl);
    if (relayerUrl) transport.relayerUrl = relayerUrl;

    const rpcOverride = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
    if (rpcOverride) transport.network = rpcOverride;

    const relayerCandidates: Array<Record<string, string>> = [transport];
    if (relayerUrl?.includes("/api/relayer/")) {
      relayerCandidates.push({
        relayerUrl: "https://relayer.testnet.zama.org/v2",
        ...(rpcOverride ? { network: rpcOverride } : {}),
      });
    }

    let lastError: unknown;
    for (const chainTransport of relayerCandidates) {
      try {
        const instance = new RelayerWeb({
          getChainId: () => Promise.resolve(CHAIN_ID),
          transports: { [CHAIN_ID]: chainTransport },
          security: {
            integrityCheck: process.env.NODE_ENV === "production",
          },
        }) as unknown as RelayerLike;

        await instance.getPublicParams(2048);
        this.relayer = instance;
        return instance;
      } catch (err) {
        lastError = err;
        this.relayer = null;
      }
    }

    const detail =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`Failed to initialize FHE worker: ${detail}`);
  }

  async encryptBatch(
    contractAddress: string,
    userAddress: string,
    recipients: RecipientPlain[],
  ): Promise<BatchEncryptResult> {
    const relayer = await this.ensureRelayer();

    const values: { value: bigint; type: string }[] = [];
    for (const r of recipients) {
      values.push(
        { value: BigInt(r.allocation), type: "euint64" },
        { value: BigInt(r.tier), type: "euint8" },
        { value: BigInt(r.vestingClass), type: "euint8" },
      );
    }

    let result;
    try {
      result = await relayer.encrypt({
        contractAddress: contractAddress as Address,
        userAddress: userAddress as Address,
        values,
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new Error(
        `Zama FHE encrypt failed: ${detail}. Try Chrome without extensions, hard refresh (Cmd+Shift+R), or temporarily set NEXT_PUBLIC_ZAMA_MODE=demo.`,
      );
    }

    const handles = result.handles;
    const encryptedRecipients = recipients.map((r, i) => ({
      wallet: r.wallet,
      amountHandle: toHex(handles[i * 3]),
      tierHandle: toHex(handles[i * 3 + 1]),
      vestingHandle: toHex(handles[i * 3 + 2]),
    }));

    return {
      recipients: encryptedRecipients,
      inputProof: toHex(result.inputProof),
    };
  }

  async decryptValue(
    handle: string,
    contractAddress: string,
    userAddress: string,
    _type: EncryptedFieldType,
  ): Promise<bigint> {
    const relayer = await this.ensureRelayer();
    if (!this.opts.walletClient || !this.opts.account) {
      throw new Error("Connect your wallet to authorize decryption (EIP-712).");
    }

    const { publicKey, privateKey } = await relayer.generateKeypair();
    const startTimestamp = Math.floor(Date.now() / 1000);
    const durationDays = 7;
    const eip712 = await relayer.createEIP712(
      publicKey,
      [contractAddress as Address],
      startTimestamp,
      durationDays,
    );

    const signature = await this.opts.walletClient.signTypedData({
      account: this.opts.account,
      domain: eip712.domain,
      types: eip712.types,
      primaryType: "UserDecryptRequestVerification",
      message: eip712.message,
    } as never);

    const clear = await relayer.userDecrypt({
      handles: [handle as `0x${string}`],
      contractAddress: contractAddress as Address,
      signedContractAddresses: [contractAddress as Address],
      privateKey,
      publicKey,
      signature,
      signerAddress: userAddress as Address,
      startTimestamp,
      durationDays,
    });

    const value = clear[handle as `0x${string}`];
    return BigInt(typeof value === "bigint" ? value : Number(value));
  }
}

function toHex(bytes: Uint8Array): string {
  return (
    "0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}
