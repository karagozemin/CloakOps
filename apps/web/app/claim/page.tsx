"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { PublicClient } from "viem";
import { useAccount, usePublicClient } from "wagmi";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/empty";
import { EncryptedField } from "@/components/campaign/encrypted-field";
import { ConnectButton } from "@/components/connect-button";
import { useCampaigns } from "@/lib/campaigns/hooks";
import { campaignStore } from "@/lib/campaigns/store";
import type { CampaignRecord, RecipientRecord } from "@/lib/campaigns/types";
import { readRecipientEligibility, readRecipientHandles } from "@/lib/contracts/read";
import { claimOnChain } from "@/lib/contracts/write";
import { RealZamaProvider } from "@/lib/zama/real-provider";
import type { EncryptedFieldType } from "@/lib/zama/types";
import { TIER_LABELS, VESTING_LABELS } from "@/lib/sample/data";
import { CLOAKOPS_CONTRACT_ADDRESS, campaignTypeLabel } from "@/lib/config";
import { resolveOnChainClients } from "@/lib/wagmi/on-chain-clients";
import { cn, formatNumber } from "@/lib/utils";
import { CheckCircle2, Lock, ShieldCheck, Wallet } from "lucide-react";

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const campaigns = useCampaigns();

  const myAllocations = useMemo(() => {
    if (!address) return [];
    return campaigns
      .map((c) => ({
        campaign: c,
        recipient: c.recipients.find(
          (r) => r.wallet.toLowerCase() === address.toLowerCase(),
        ),
      }))
      .filter((x): x is { campaign: CampaignRecord; recipient: RecipientRecord } =>
        Boolean(x.recipient),
      );
  }, [campaigns, address]);

  async function decryptField(
    handle: string,
    type: EncryptedFieldType,
  ): Promise<bigint> {
    if (!address || !publicClient || !CLOAKOPS_CONTRACT_ADDRESS) {
      throw new Error("Connect your wallet on Sepolia to decrypt.");
    }
    const clients = await resolveOnChainClients(address, publicClient);
    const provider = new RealZamaProvider({
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      account: clients.account,
    });
    return provider.decryptValue(
      handle,
      CLOAKOPS_CONTRACT_ADDRESS,
      address,
      type,
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Recipient"
        title="Claim your confidential allocation"
        description="Only you can decrypt your allocation. The public can verify the campaign rules, but not your private deal."
        action={isConnected ? undefined : <ConnectButton />}
      />

      {!isConnected ? (
        <div className="mt-8">
          <EmptyState
            icon={<Wallet className="h-7 w-7" />}
            title="Connect your wallet"
            description="Connect on Sepolia to check eligibility and decrypt your private allocation, tier, and vesting class."
            action={<ConnectButton />}
          />
        </div>
      ) : myAllocations.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title="No allocation found for this wallet"
            description="Your address must be in the admin CSV when the campaign is created on Sepolia. Ask the campaign admin to include your wallet, then create the campaign from /admin."
            action={
              <Link href="/admin" className="btn-primary">
                Go to admin
              </Link>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {myAllocations.map(({ campaign, recipient }) => (
            <AllocationCard
              key={`${campaign.id}-${recipient.wallet}`}
              campaign={campaign}
              recipient={recipient}
              address={address!}
              publicClient={publicClient}
              decrypt={(handle, type) => decryptField(handle, type)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function AllocationCard({
  campaign,
  recipient,
  address,
  publicClient,
  decrypt,
}: {
  campaign: CampaignRecord;
  recipient: RecipientRecord;
  address: string;
  publicClient?: PublicClient;
  decrypt: (handle: string, type: EncryptedFieldType) => Promise<bigint>;
}) {
  const [claimed, setClaimed] = useState(recipient.claimed);
  const [claiming, setClaiming] = useState(false);
  const [handles, setHandles] = useState({
    amount: recipient.amountHandle,
    tier: recipient.tierHandle,
    vesting: recipient.vestingHandle,
  });

  useEffect(() => {
    if (!publicClient || !campaign.onChainId) return;

    let active = true;
    readRecipientHandles(
      publicClient,
      BigInt(campaign.onChainId),
      address as `0x${string}`,
    )
      .then((chainHandles) => {
        if (!active) return;
        setHandles({
          amount: chainHandles.amountHandle,
          tier: chainHandles.tierHandle,
          vesting: chainHandles.vestingHandle,
        });
      })
      .catch(() => {});

    readRecipientEligibility(
      publicClient,
      BigInt(campaign.onChainId),
      address as `0x${string}`,
    )
      .then((state) => {
        if (active && state.claimed) setClaimed(true);
      })
      .catch(() => {});

    return () => {
      active = false;
    };
  }, [campaign.onChainId, publicClient, address]);

  const now = Math.floor(Date.now() / 1000);
  const windowOpen = now >= campaign.claimStart && now <= campaign.claimEnd;
  const canDecrypt = address.toLowerCase() === recipient.wallet.toLowerCase();

  async function handleClaim() {
    if (!publicClient || !campaign.onChainId) return;
    setClaiming(true);
    try {
      const clients = await resolveOnChainClients(
        address as `0x${string}`,
        publicClient,
      );
      await claimOnChain(
        clients.walletClient,
        clients.publicClient,
        clients.account,
        BigInt(campaign.onChainId),
      );
      campaignStore.markClaimed(campaign.id, address);
      setClaimed(true);
    } finally {
      setClaiming(false);
    }
  }

  return (
    <Card>
      <CardHeader
        icon={<ShieldCheck className="h-4 w-4" />}
        title={campaign.name}
        subtitle={`${campaignTypeLabel(campaign.campaignType)} · Confidential allocation on Sepolia`}
        action={
          <Link href={`/public-audit/${campaign.id}`} className="btn-subtle">
            Public rules
          </Link>
        }
      />
      <CardBody className="space-y-5">
        <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-cloak-muted">
          <Lock className="h-3.5 w-3.5 shrink-0 text-gold" />
          Recipient addresses are visible on-chain; allocation amounts, tiers, and
          vesting classes are encrypted with Zama FHE. Only your wallet can decrypt.
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <EncryptedField
            label="Allocation"
            handle={handles.amount}
            canDecrypt={canDecrypt}
            disabledReason="Only the recipient wallet can decrypt."
            onDecrypt={() => decrypt(handles.amount, "euint64")}
            format={(v) => formatNumber(Number(v))}
          />
          <EncryptedField
            label="Tier"
            handle={handles.tier}
            canDecrypt={canDecrypt}
            disabledReason="Only the recipient wallet can decrypt."
            onDecrypt={() => decrypt(handles.tier, "euint8")}
            format={(v) => TIER_LABELS[Number(v)] ?? `Tier ${v}`}
          />
          <EncryptedField
            label="Vesting class"
            handle={handles.vesting}
            canDecrypt={canDecrypt}
            disabledReason="Only the recipient wallet can decrypt."
            onDecrypt={() => decrypt(handles.vesting, "euint8")}
            format={(v) => VESTING_LABELS[Number(v)] ?? `Class ${v}`}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cloak-line pt-4">
          <div className="flex items-center gap-2 text-xs text-cloak-muted">
            <span>Role label (private):</span>
            <Badge tone="neutral">{recipient.role}</Badge>
          </div>
          {claimed ? (
            <Badge tone="ok" dot>
              <CheckCircle2 className="h-3.5 w-3.5" /> Claimed
            </Badge>
          ) : (
            <button
              className={cn("btn-primary", !windowOpen && "opacity-50")}
              onClick={handleClaim}
              disabled={claiming || !windowOpen}
              title={!windowOpen ? "Claim window is not open." : undefined}
            >
              {claiming
                ? "Claiming…"
                : windowOpen
                  ? "Claim allocation"
                  : "Claim window closed"}
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
