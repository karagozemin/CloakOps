import type { Address, PublicClient, WalletClient } from "viem";
import { CHAIN_ID } from "@/lib/config";
import type {
  BatchEncryptResult,
  EncryptedFieldType,
  RecipientPlain,
  ZamaProvider,
  ZamaStatus,
} from "./types";

export interface RealZamaProviderOptions {
  publicClient?: PublicClient;
  walletClient?: WalletClient;
  account?: Address;
  /** Backend proxy for the Zama relayer; defaults to /api/relayer/<chainId>. */
  relayerUrl?: string;
}

/** Minimal structural type for the relayer methods this provider uses. */
interface RelayerLike {
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

  private async ensureRelayer() {
    if (this.relayer) return this.relayer;
    if (!this.opts.publicClient) {
      throw new Error("Missing viem public client (connect a wallet on Sepolia).");
    }
    const { RelayerWeb, SepoliaConfig } = await import("@zama-fhe/sdk");
    const relayerUrl =
      this.opts.relayerUrl ?? `/api/relayer/${CHAIN_ID}`;

    this.relayer = new RelayerWeb({
      getChainId: async () => CHAIN_ID,
      transports: {
        [SepoliaConfig.chainId]: {
          ...SepoliaConfig,
          relayerUrl,
        },
      },
    } as unknown as ConstructorParameters<typeof RelayerWeb>[0]) as unknown as RelayerLike;
    return this.relayer;
  }

  async encryptBatch(
    contractAddress: string,
    userAddress: string,
    recipients: RecipientPlain[],
  ): Promise<BatchEncryptResult> {
    const relayer = await this.ensureRelayer();

    // Single encrypt call → one shared inputProof for batchAddRecipients.
    const values: { value: bigint; type: string }[] = [];
    for (const r of recipients) {
      values.push(
        { value: BigInt(r.allocation), type: "euint64" },
        { value: BigInt(r.tier), type: "euint8" },
        { value: BigInt(r.vestingClass), type: "euint8" },
      );
    }

    const result = await relayer.encrypt({
      contractAddress: contractAddress as Address,
      userAddress: userAddress as Address,
      values,
    });

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
