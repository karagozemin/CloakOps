import type { Address, PublicClient } from "viem";
import { getContractConfig } from "@/lib/contracts";

export async function readRecipientHandles(
  publicClient: PublicClient,
  campaignId: bigint,
  recipient: Address,
): Promise<{
  amountHandle: `0x${string}`;
  tierHandle: `0x${string}`;
  vestingHandle: `0x${string}`;
}> {
  const cfg = getContractConfig();
  if (!cfg) {
    throw new Error("NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS is not set.");
  }

  const [amountHandle, tierHandle, vestingHandle] = await publicClient.multicall({
    contracts: [
      {
        ...cfg,
        functionName: "getEncryptedAllocation",
        args: [campaignId, recipient],
      },
      {
        ...cfg,
        functionName: "getEncryptedTier",
        args: [campaignId, recipient],
      },
      {
        ...cfg,
        functionName: "getEncryptedVestingClass",
        args: [campaignId, recipient],
      },
    ],
  });

  if (
    amountHandle.status === "failure" ||
    tierHandle.status === "failure" ||
    vestingHandle.status === "failure"
  ) {
    throw new Error("Could not read encrypted handles from ConfidentialCampaign.");
  }

  return {
    amountHandle: amountHandle.result as `0x${string}`,
    tierHandle: tierHandle.result as `0x${string}`,
    vestingHandle: vestingHandle.result as `0x${string}`,
  };
}

export interface OnChainPublicCampaign {
  admin: Address;
  name: string;
  metadataURI: string;
  campaignType: number;
  totalBudget: bigint;
  recipientCount: bigint;
  claimStart: bigint;
  claimEnd: bigint;
  claimedCount: bigint;
  token: Address;
  exists: boolean;
}

export async function readPublicCampaign(
  publicClient: PublicClient,
  campaignId: bigint,
): Promise<OnChainPublicCampaign | null> {
  const cfg = getContractConfig();
  if (!cfg) return null;

  try {
    const c = (await publicClient.readContract({
      ...cfg,
      functionName: "getPublicCampaign",
      args: [campaignId],
    })) as {
      admin: Address;
      name: string;
      metadataURI: string;
      campaignType: number;
      totalBudget: bigint;
      recipientCount: bigint;
      claimStart: bigint;
      claimEnd: bigint;
      claimedCount: bigint;
      token: Address;
      exists: boolean;
    };
    if (!c.exists) return null;
    return c;
  } catch {
    return null;
  }
}

export async function readCampaignCount(
  publicClient: PublicClient,
): Promise<number> {
  const cfg = getContractConfig();
  if (!cfg) return 0;
  try {
    const count = (await publicClient.readContract({
      ...cfg,
      functionName: "campaignCount",
    })) as bigint;
    return Number(count);
  } catch {
    return 0;
  }
}

export interface OnChainAllocation {
  campaignId: number;
  campaign: OnChainPublicCampaign;
  amountHandle: `0x${string}`;
  tierHandle: `0x${string}`;
  vestingHandle: `0x${string}`;
  claimed: boolean;
}

/**
 * Scans every campaign on the contract and returns the ones where `recipient`
 * is eligible. No per-recipient index exists on-chain, so we enumerate
 * 1..campaignCount and batch the eligibility checks via multicall.
 */
export async function findRecipientAllocations(
  publicClient: PublicClient,
  recipient: Address,
): Promise<OnChainAllocation[]> {
  const cfg = getContractConfig();
  if (!cfg) return [];

  const count = await readCampaignCount(publicClient);
  if (count <= 0) return [];

  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));

  const eligibility = await publicClient.multicall({
    contracts: ids.map((id) => ({
      ...cfg,
      functionName: "isEligible" as const,
      args: [id, recipient] as const,
    })),
  });

  const eligibleIds = ids.filter(
    (_, i) =>
      eligibility[i]?.status === "success" && Boolean(eligibility[i].result),
  );
  if (eligibleIds.length === 0) return [];

  const results = await Promise.all(
    eligibleIds.map(async (id) => {
      const [campaign, handles, eligible] = await Promise.all([
        readPublicCampaign(publicClient, id),
        readRecipientHandles(publicClient, id, recipient),
        readRecipientEligibility(publicClient, id, recipient),
      ]);
      if (!campaign) return null;
      return {
        campaignId: Number(id),
        campaign,
        amountHandle: handles.amountHandle,
        tierHandle: handles.tierHandle,
        vestingHandle: handles.vestingHandle,
        claimed: eligible.claimed,
      } satisfies OnChainAllocation;
    }),
  );

  return results.filter((r): r is OnChainAllocation => r !== null);
}

export async function readRecipientEligibility(
  publicClient: PublicClient,
  campaignId: bigint,
  recipient: Address,
): Promise<{ eligible: boolean; claimed: boolean }> {
  const cfg = getContractConfig();
  if (!cfg) {
    return { eligible: false, claimed: false };
  }

  const [eligible, claimed] = await publicClient.multicall({
    contracts: [
      {
        ...cfg,
        functionName: "isEligible",
        args: [campaignId, recipient],
      },
      {
        ...cfg,
        functionName: "hasClaimed",
        args: [campaignId, recipient],
      },
    ],
  });

  return {
    eligible: eligible.status === "success" ? Boolean(eligible.result) : false,
    claimed: claimed.status === "success" ? Boolean(claimed.result) : false,
  };
}
