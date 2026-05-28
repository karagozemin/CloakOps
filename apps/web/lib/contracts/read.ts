import type { Address, PublicClient } from "viem";
import { getContractConfig } from "@/lib/contracts";
import { confidentialTokenAbi } from "./confidential-token-abi";

/** Reads the encrypted confidential-token balance handle for `account`. */
export async function readConfidentialBalance(
  publicClient: PublicClient,
  tokenAddress: Address,
  account: Address,
): Promise<`0x${string}` | null> {
  try {
    const handle = (await publicClient.readContract({
      address: tokenAddress,
      abi: confidentialTokenAbi,
      functionName: "confidentialBalanceOf",
      args: [account],
    })) as `0x${string}`;
    return handle;
  } catch {
    return null;
  }
}

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

export async function readAllPublicCampaigns(
  publicClient: PublicClient,
): Promise<{ campaignId: number; campaign: OnChainPublicCampaign }[]> {
  const cfg = getContractConfig();
  if (!cfg) return [];

  const count = await readCampaignCount(publicClient);
  if (count <= 0) return [];

  const ids = Array.from({ length: count }, (_, i) => BigInt(i + 1));
  const results = await publicClient.multicall({
    contracts: ids.map((id) => ({
      ...cfg,
      functionName: "getPublicCampaign" as const,
      args: [id] as const,
    })),
  });

  const out: { campaignId: number; campaign: OnChainPublicCampaign }[] = [];
  results.forEach((r, i) => {
    if (r.status === "success" && r.result) {
      const c = r.result as OnChainPublicCampaign;
      if (c.exists) out.push({ campaignId: Number(ids[i]), campaign: c });
    }
  });
  return out;
}

/**
 * Recipient addresses are public but not enumerable via a view function, so we
 * read them from `RecipientAdded` event logs and check claim status per address.
 * Degrades gracefully (returns []) if the RPC rejects the log range.
 */
export async function readCampaignRecipients(
  publicClient: PublicClient,
  campaignId: bigint,
): Promise<{ wallet: Address; claimed: boolean }[]> {
  const cfg = getContractConfig();
  if (!cfg) return [];

  try {
    const logs = await publicClient.getContractEvents({
      ...cfg,
      eventName: "RecipientAdded",
      args: { campaignId },
      fromBlock: "earliest",
      toBlock: "latest",
    });

    const wallets = Array.from(
      new Set(
        logs
          .map((l) => (l.args as { recipient?: Address }).recipient)
          .filter((w): w is Address => Boolean(w)),
      ),
    );
    if (wallets.length === 0) return [];

    const claimedResults = await publicClient.multicall({
      contracts: wallets.map((w) => ({
        ...cfg,
        functionName: "hasClaimed" as const,
        args: [campaignId, w] as const,
      })),
    });

    return wallets.map((wallet, i) => ({
      wallet,
      claimed:
        claimedResults[i]?.status === "success"
          ? Boolean(claimedResults[i].result)
          : false,
    }));
  } catch {
    return [];
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
