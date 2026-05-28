/**
 * Zama FHE dual-mode encryption layer.
 *
 * - demo mode: deterministic local encryption so the full product flow works
 *   with no deployed contract, relayer, or testnet funds. Encrypted handles are
 *   opaque; the cleartext is only recoverable through this provider, gated in
 *   the UI by wallet ownership (simulating the FHE ACL).
 * - real mode: uses the Zama Relayer SDK against the deployed ConfidentialCampaign
 *   contract on Sepolia.
 */

export type ZamaMode = "real" | "demo";

export type EncryptedFieldType = "euint64" | "euint8";

export interface RecipientPlain {
  wallet: string;
  allocation: number;
  tier: number;
  vestingClass: number;
}

export interface EncryptedRecipient {
  wallet: string;
  amountHandle: string;
  tierHandle: string;
  vestingHandle: string;
}

export interface BatchEncryptResult {
  recipients: EncryptedRecipient[];
  /** Single shared ZK input proof (hex). */
  inputProof: string;
}

export interface ZamaStatus {
  mode: ZamaMode;
  ready: boolean;
  message: string;
}

export interface ZamaProvider {
  readonly mode: ZamaMode;
  getStatus(): Promise<ZamaStatus>;
  /** Encrypt a batch of recipients under a single input proof. */
  encryptBatch(
    contractAddress: string,
    userAddress: string,
    recipients: RecipientPlain[],
  ): Promise<BatchEncryptResult>;
  /** Decrypt a single handle for `userAddress` (must be on the FHE ACL). */
  decryptValue(
    handle: string,
    contractAddress: string,
    userAddress: string,
    type: EncryptedFieldType,
  ): Promise<bigint>;
}
