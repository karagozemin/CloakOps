import { getAddress } from "viem";

/**
 * Normalize an address env value: trim stray spaces/newlines (common when
 * pasting into Vercel) and re-checksum from lowercase so a wrong-case input
 * never trips viem's EIP-55 checksum validation.
 */
function envAddress(value: string | undefined): `0x${string}` | "" {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  try {
    return getAddress(trimmed.toLowerCase());
  } catch {
    return trimmed as `0x${string}`;
  }
}

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);

export const CLOAKOPS_CONTRACT_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS,
);

/** CloakConfidentialToken — the confidential payout asset credited on claim. */
export const CLOAKOPS_TOKEN_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_CLOAKOPS_TOKEN_ADDRESS,
);

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const EXPLORER_BASE = "https://sepolia.etherscan.io";

export function explorerAddress(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

export function explorerTx(txHash: string): string {
  return `${EXPLORER_BASE}/tx/${txHash}`;
}

/** Campaign types — must match the on-chain enum order. */
export const CAMPAIGN_TYPES = [
  {
    id: 0,
    key: "private-round",
    label: "Private Round",
    blurb: "Seed / strategic investor allocations",
  },
  {
    id: 1,
    key: "contributor-reward",
    label: "Contributor Rewards",
    blurb: "Core + community contributor payouts",
  },
  {
    id: 2,
    key: "advisor-vesting",
    label: "Advisor Vesting",
    blurb: "Advisor grants on a vesting schedule",
  },
  {
    id: 3,
    key: "community-distribution",
    label: "Community Distribution",
    blurb: "Airdrops and community campaigns",
  },
] as const;

export function campaignTypeLabel(id: number): string {
  return CAMPAIGN_TYPES.find((t) => t.id === id)?.label ?? "Unknown";
}

export const hasLiveContractAddressNote =
  "Not configured (set NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS after deploy)";

/**
 * TokenOps confidential vesting factory
 * (`TokenOpsVestingWalletCliffExecutorConfidentialFactory`) on Sepolia — the
 * same contract the app.tokenops.xyz dashboard deploys vesting wallets through.
 * createVestingWalletConfidential + batchFundVestingWalletConfidential live here.
 */
export const TOKENOPS_VESTING_FACTORY =
  envAddress(process.env.NEXT_PUBLIC_TOKENOPS_VESTING_FACTORY) ||
  envAddress("0x98c519f9de1dc8c8cb3eb9b0b09b3ce057beb72a") ||
  ("" as `0x${string}`);

/**
 * ERC-7984 token the vesting factory pulls via confidentialTransferFrom
 * (e.g. the CTestToken faucet on Sepolia).
 */
export const TOKENOPS_VESTING_TOKEN = envAddress(
  process.env.NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN,
);

/**
 * When true (default), the campaign creator auto-mints the required confidential
 * test-token balance before funding TokenOps vesting. The configured vesting
 * token must be a permissionless faucet (TestConfidentialWrapper.mint). Set to
 * "false" for production tokens that are not mintable by arbitrary callers.
 */
export const TOKENOPS_AUTO_MINT =
  process.env.NEXT_PUBLIC_TOKENOPS_AUTO_MINT !== "false";

/** ERC-7984 token for TokenOps vesting txs — env override or CloakOps token. */
export function tokenOpsVestingToken(
  campaignToken?: string,
): `0x${string}` {
  if (TOKENOPS_VESTING_TOKEN) return TOKENOPS_VESTING_TOKEN;
  if (campaignToken) return campaignToken as `0x${string}`;
  if (CLOAKOPS_TOKEN_ADDRESS) return CLOAKOPS_TOKEN_ADDRESS;
  throw new Error(
    "Set NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN or NEXT_PUBLIC_CLOAKOPS_TOKEN_ADDRESS.",
  );
}
