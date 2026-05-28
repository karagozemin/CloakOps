import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { keccak256, toBytes } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { CHAIN_ID } from "@/lib/config";

/** uint48 operator deadline (~year 2033). */
export const OPERATOR_DEADLINE = 2_000_000_000;

export function resolveTokenOpsRelayerUrl(): string | undefined {
  const useProxy = process.env.NEXT_PUBLIC_ZAMA_USE_RELAYER_PROXY !== "false";
  if (typeof window !== "undefined" && useProxy) {
    return `${window.location.origin}/api/relayer/${CHAIN_ID}`;
  }
  return (
    process.env.NEXT_PUBLIC_ZAMA_RELAYER_URL ??
    "https://relayer.testnet.zama.org/v2"
  );
}

export function campaignManagerSalt(cloakOpsCampaignId?: string): Hex {
  if (cloakOpsCampaignId) {
    return keccak256(toBytes(`cloakops-vesting-${cloakOpsCampaignId}`));
  }
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return ("0x" +
    Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as Hex;
}

export interface VestingScheduleParams {
  recipient: Address;
  startTimestamp: number;
  endTimestamp: number;
  cliffSeconds: number;
  releaseIntervalSecs: number;
  timelockSeconds: number;
  initialUnlockBps: number;
  cliffAmountBps: number;
  isRevocable: boolean;
}

/** Map CloakOps claim window + vesting class to TokenOps VestingParams. */
export function buildVestingParams(
  recipient: Address,
  claimStart: number,
  claimEnd: number,
  vestingClass: number,
): VestingScheduleParams {
  const startTimestamp = claimStart;
  const endTimestamp = Math.max(claimEnd, claimStart + 86400);
  const duration = endTimestamp - startTimestamp;
  const cliffSeconds =
    vestingClass > 0
      ? Math.min(vestingClass * 30 * 86400, Math.max(duration - 86400, 0))
      : 0;
  const immediate = vestingClass === 0;

  return {
    recipient,
    startTimestamp,
    endTimestamp,
    cliffSeconds,
    releaseIntervalSecs: 86400,
    timelockSeconds: 0,
    initialUnlockBps: immediate ? 10_000 : 0,
    cliffAmountBps: 0,
    isRevocable: false,
  };
}

/** Authorise the vesting manager to pull confidential tokens from the admin wallet. */
export async function ensureTokenOperator(
  token: Address,
  manager: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
): Promise<Hex> {
  const { erc7984OperatorAbi } = await import("@tokenops/sdk/fhe-vesting");

  const hash = await walletClient.writeContract({
    address: token,
    abi: erc7984OperatorAbi,
    functionName: "setOperator",
    args: [manager, OPERATOR_DEADLINE],
    account,
    chain: walletClient.chain,
  });

  await waitForTransactionReceipt(publicClient, { hash });
  return hash;
}
