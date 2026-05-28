/**
 * Zama FHE encryption layer — Zama Relayer SDK on Sepolia.
 */

export type ZamaMode = "real";

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
  encryptBatch(
    contractAddress: string,
    userAddress: string,
    recipients: RecipientPlain[],
  ): Promise<BatchEncryptResult>;
  decryptValue(
    handle: string,
    contractAddress: string,
    userAddress: string,
    type: EncryptedFieldType,
  ): Promise<bigint>;
}
