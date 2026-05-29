import type { Address, Hex, PublicClient, WalletClient } from "viem";
import { encodeAbiParameters } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { CHAIN_ID } from "@/lib/config";

/** uint48 operator deadline (~year 2033). */
export const OPERATOR_DEADLINE = 2_000_000_000;

/**
 * Minimal ABI for `TokenOpsVestingWalletCliffExecutorConfidentialFactory` —
 * the on-chain contract the TokenOps dashboard deploys vesting wallets through.
 */
export const TOKENOPS_VESTING_FACTORY_ABI = [
  {
    type: "function",
    name: "createVestingWalletConfidential",
    stateMutability: "nonpayable",
    inputs: [{ name: "initArgs", type: "bytes" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "predictVestingWalletConfidential",
    stateMutability: "view",
    inputs: [{ name: "initArgs", type: "bytes" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "batchFundVestingWalletConfidential",
    stateMutability: "nonpayable",
    inputs: [
      { name: "token", type: "address" },
      {
        name: "vestingPlans",
        type: "tuple[]",
        components: [
          { name: "encryptedAmount", type: "bytes32" },
          { name: "initArgs", type: "bytes" },
        ],
      },
      { name: "inputProof", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

/** ABI parameter layout for the CliffExecutor vesting wallet `initialize`. */
const INIT_ARGS_PARAMS = [
  { name: "beneficiary", type: "address" },
  { name: "startTimestamp", type: "uint48" },
  { name: "durationSeconds", type: "uint48" },
  { name: "cliffSeconds", type: "uint48" },
  { name: "executor", type: "address" },
] as const;

/**
 * Encode the `initArgs` bytes consumed by createVestingWalletConfidential /
 * batchFundVestingWalletConfidential. The salt (and therefore the wallet
 * address) is `keccak256(initArgs)`, so the same beneficiary+schedule+executor
 * always maps to one deterministic vesting wallet.
 */
export function buildVestingInitArgs(
  beneficiary: Address,
  claimStart: number,
  claimEnd: number,
  vestingClass: number,
  executor: Address,
): Hex {
  const startTimestamp = claimStart;
  const endTimestamp = Math.max(claimEnd, claimStart + 86400);
  const durationSeconds = endTimestamp - startTimestamp;
  const cliffSeconds =
    vestingClass > 0
      ? Math.min(vestingClass * 30 * 86400, Math.max(durationSeconds - 1, 0))
      : 0;

  return encodeAbiParameters(INIT_ARGS_PARAMS, [
    beneficiary,
    startTimestamp,
    durationSeconds,
    cliffSeconds,
    executor,
  ]);
}

/**
 * Minimal ABI for the confidential test-token faucet (`TestConfidentialWrapper`).
 * `mint(address,uint64)` is permissionless on Sepolia — any wallet can mint test
 * balance to itself so the factory's confidentialTransferFrom has funds to pull.
 */
export const CONFIDENTIAL_TEST_TOKEN_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint64" },
    ],
    outputs: [{ name: "minted", type: "bytes32" }],
  },
] as const;

/** Canonical Multicall3 (same address on every chain, incl. Sepolia). */
export const MULTICALL3_ADDRESS =
  "0xcA11bde05977b3631167028862bE2a173976CA11" as const;

export const MULTICALL3_ABI = [
  {
    type: "function",
    name: "aggregate3",
    stateMutability: "payable",
    inputs: [
      {
        name: "calls",
        type: "tuple[]",
        components: [
          { name: "target", type: "address" },
          { name: "allowFailure", type: "bool" },
          { name: "callData", type: "bytes" },
        ],
      },
    ],
    outputs: [
      {
        name: "returnData",
        type: "tuple[]",
        components: [
          { name: "success", type: "bool" },
          { name: "returnData", type: "bytes" },
        ],
      },
    ],
  },
] as const;

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

/**
 * Authorise a spender (factory/manager) to pull confidential tokens from the
 * admin wallet. Skips the tx (returns null) when the operator is already set —
 * the deadline is far in the future, so it only ever costs one signature.
 */
export async function ensureTokenOperator(
  token: Address,
  manager: Address,
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
): Promise<Hex | null> {
  const { erc7984OperatorAbi } = await import("@tokenops/sdk/fhe-vesting");

  const alreadyOperator = await publicClient.readContract({
    address: token,
    abi: erc7984OperatorAbi,
    functionName: "isOperator",
    args: [account, manager],
  });
  if (alreadyOperator) return null;

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
