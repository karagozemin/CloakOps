import { sepolia } from "viem/chains";
import { getAddress, isAddress } from "viem";

/**
 * Normalize an address env value: trim stray spaces/newlines (common when
 * pasting into Vercel) and re-checksum so viem never rejects it.
 */
function envAddress(value: string | undefined): `0x${string}` | "" {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return "";
  if (isAddress(trimmed)) return getAddress(trimmed);
  return trimmed as `0x${string}`;
}

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 11155111);
export const NETWORK_NAME = process.env.NEXT_PUBLIC_NETWORK_NAME ?? "sepolia";

export const CLOAKOPS_CONTRACT_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS,
);

/** CloakConfidentialToken — the confidential payout asset credited on claim. */
export const CLOAKOPS_TOKEN_ADDRESS = envAddress(
  process.env.NEXT_PUBLIC_CLOAKOPS_TOKEN_ADDRESS,
);

/** Always real — Zama Relayer SDK on Sepolia. */
export const ZAMA_MODE = "real" as const;

/** Always real — @tokenops/sdk + live vesting link. */
export const TOKENOPS_MODE = "real" as const;

export const WALLETCONNECT_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

export const ACTIVE_CHAIN = sepolia;

export const EXPLORER_BASE = "https://sepolia.etherscan.io";

export function explorerAddress(address: string): string {
  return `${EXPLORER_BASE}/address/${address}`;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER_BASE}/tx/${hash}`;
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

export type CampaignTypeId = (typeof CAMPAIGN_TYPES)[number]["id"];

export function campaignTypeLabel(id: number): string {
  return CAMPAIGN_TYPES.find((t) => t.id === id)?.label ?? "Unknown";
}

export const isContractConfigured = Boolean(CLOAKOPS_CONTRACT_ADDRESS);

export const hasLiveContractAddressNote =
  "Not configured (set NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS after deploy)";

/** TokenOps x ZAMA vesting schedule deployed on Sepolia (tracking page + contract). */
export const TOKENOPS_VESTING_SCHEDULE_ID =
  process.env.NEXT_PUBLIC_TOKENOPS_VESTING_SCHEDULE_ID ??
  "6a189b396f763543bff332be";

export const TOKENOPS_VESTING_CONTRACT =
  envAddress(process.env.NEXT_PUBLIC_TOKENOPS_VESTING_CONTRACT) ||
  ("0xE1Fce9e572efFa42BBE851A44D2d00d2c808c494" as `0x${string}`);

/**
 * ERC-7984 token the configured vesting manager accepts.
 * Must match the manager's immutable token (e.g. CTestToken on the linked schedule).
 */
export const TOKENOPS_VESTING_TOKEN = envAddress(
  process.env.NEXT_PUBLIC_TOKENOPS_VESTING_TOKEN,
);

export const TOKENOPS_VESTING_SCHEDULE_URL =
  process.env.NEXT_PUBLIC_TOKENOPS_VESTING_SCHEDULE_URL ??
  `https://app.tokenops.xyz/contract/schedules/${TOKENOPS_VESTING_SCHEDULE_ID}`;

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

/** TokenOps dashboard URL when the manager matches the configured schedule. */
export function tokenOpsDashboardUrl(managerAddress: string): string | undefined {
  const link = tokenOpsVestingLink();
  if (
    link &&
    managerAddress.toLowerCase() === link.contract.toLowerCase()
  ) {
    return link.url;
  }
  return undefined;
}

/** Live TokenOps vesting rail link when schedule id is configured. */
export function tokenOpsVestingLink():
  | { id: string; url: string; contract: `0x${string}` }
  | undefined {
  if (!TOKENOPS_VESTING_SCHEDULE_ID) return undefined;
  return {
    id: TOKENOPS_VESTING_SCHEDULE_ID,
    url: TOKENOPS_VESTING_SCHEDULE_URL,
    contract: TOKENOPS_VESTING_CONTRACT,
  };
}
