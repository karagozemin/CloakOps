"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePublicClient } from "wagmi";
import {
  readAllPublicCampaigns,
  readCampaignRecipients,
  readPublicCampaign,
  type OnChainPublicCampaign,
} from "@/lib/contracts/read";
import { useCampaigns } from "./hooks";
import type { CampaignRecord, RecipientRecord } from "./types";

function toRecord(
  campaignId: number,
  c: OnChainPublicCampaign,
  recipients: RecipientRecord[],
): CampaignRecord {
  return {
    id: String(campaignId),
    onChainId: campaignId,
    name: c.name,
    metadataURI: c.metadataURI,
    campaignType: c.campaignType,
    totalBudget: c.totalBudget.toString(),
    tokenAddress: c.token,
    admin: c.admin,
    claimStart: Number(c.claimStart),
    claimEnd: Number(c.claimEnd),
    recipients,
    createdAt: Date.now(),
    source: "onchain",
  };
}

/** All campaigns read directly from the contract, merged with local records
 *  (local wins because it carries off-chain notes + private role labels). */
export function useAllCampaigns(): {
  campaigns: CampaignRecord[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const publicClient = usePublicClient();
  const local = useCampaigns();
  const [chain, setChain] = useState<CampaignRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const list = await readAllPublicCampaigns(publicClient);
      setChain(
        list.map(({ campaignId, campaign }) => {
          // Pad a recipients array purely so the public counts render correctly
          // on the index (wallets aren't shown here; the detail page reads the
          // real ledger from events).
          const total = Number(campaign.recipientCount);
          const claimed = Number(campaign.claimedCount);
          const recipients: RecipientRecord[] = Array.from(
            { length: total },
            (_, i) => ({
              wallet: `placeholder-${campaignId}-${i}`,
              amountHandle: "",
              tierHandle: "",
              vestingHandle: "",
              role: "—",
              claimed: i < claimed,
            }),
          );
          return toRecord(campaignId, campaign, recipients);
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read campaigns on-chain.");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  useEffect(() => {
    void load();
  }, [load]);

  const campaigns = useMemo(() => {
    const byId = new Map<string, CampaignRecord>();
    // On-chain list is the source of truth for which campaigns exist.
    for (const c of chain) byId.set(c.id, c);
    // Local storage only enriches campaigns that still exist on the contract
    // (notes, role labels). Stale entries from a previous deploy are ignored.
    for (const c of local) {
      const onChain = byId.get(c.id);
      if (!onChain) continue;
      byId.set(c.id, {
        ...onChain,
        ...c,
        id: onChain.id,
        onChainId: onChain.onChainId,
        // Keep local role labels when present; fall back to chain ledger.
        recipients:
          c.recipients.length > 0 &&
          !c.recipients[0]?.wallet.startsWith("placeholder-")
            ? c.recipients
            : onChain.recipients,
      });
    }
    return Array.from(byId.values()).sort(
      (a, b) => (b.onChainId ?? 0) - (a.onChainId ?? 0),
    );
  }, [chain, local]);

  return { campaigns, loading, error, refresh: load };
}

/** Single campaign: on-chain is source of truth; local enriches notes/roles. */
export function useCampaignOrChain(id: string): {
  campaign: CampaignRecord | undefined;
  loading: boolean;
} {
  const publicClient = usePublicClient();
  const local = useCampaigns();
  const localMatch = useMemo(
    () => local.find((c) => c.id === id || String(c.onChainId) === id),
    [local, id],
  );

  const [chain, setChain] = useState<CampaignRecord | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!publicClient || !/^\d+$/.test(id)) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const campaignId = BigInt(id);
      const c = await readPublicCampaign(publicClient, campaignId);
      if (!c) {
        if (active) {
          setChain(undefined);
          setLoading(false);
        }
        return;
      }
      const recipients = await readCampaignRecipients(publicClient, campaignId);
      if (!active) return;
      setChain(
        toRecord(
          Number(campaignId),
          c,
          recipients.map((r) => ({
            wallet: r.wallet,
            amountHandle: "",
            tierHandle: "",
            vestingHandle: "",
            role: "—",
            claimed: r.claimed,
          })),
        ),
      );
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id, publicClient]);

  const campaign = useMemo(() => {
    if (!chain) return undefined;
    if (!localMatch || localMatch.id !== chain.id) return chain;
    return {
      ...chain,
      notes: localMatch.notes ?? chain.notes,
      tokenOpsCampaignId: localMatch.tokenOpsCampaignId ?? chain.tokenOpsCampaignId,
      tokenOpsUrl: localMatch.tokenOpsUrl ?? chain.tokenOpsUrl,
      txHash: localMatch.txHash ?? chain.txHash,
      recipients:
        localMatch.recipients.length > 0 &&
        !localMatch.recipients[0]?.wallet.startsWith("placeholder-")
          ? localMatch.recipients
          : chain.recipients,
    };
  }, [chain, localMatch]);

  return { campaign, loading };
}
