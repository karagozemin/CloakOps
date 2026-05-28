"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/empty";
import { EncryptedField } from "@/components/campaign/encrypted-field";
import { ConnectButton } from "@/components/connect-button";
import { useCampaigns } from "@/lib/campaigns/hooks";
import { campaignStore } from "@/lib/campaigns/store";
import type { CampaignRecord, RecipientRecord } from "@/lib/campaigns/types";
import { DemoZamaProvider } from "@/lib/zama/demo-provider";
import { useZama } from "@/lib/zama";
import { TIER_LABELS, VESTING_LABELS } from "@/lib/demo/data";
import { campaignTypeLabel } from "@/lib/config";
import { cn, formatNumber, shortAddress } from "@/lib/utils";
import {
  CheckCircle2,
  Lock,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const campaigns = useCampaigns();
  const { provider: realProvider } = useZama();
  const [adding, setAdding] = useState(false);

  const demoProvider = useMemo(() => new DemoZamaProvider(), []);

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

  async function addMeToDemo() {
    if (!address) return;
    setAdding(true);
    try {
      const sample = {
        wallet: address,
        allocation: 120000,
        tier: 4,
        vestingClass: 2,
        role: "core-contributor (you)",
      };
      const enc = await demoProvider.encryptBatch(
        "0xC10a4000000000000000000000000000000C0a4e",
        address,
        [sample],
      );
      campaignStore.addRecipient("1", {
        ...enc.recipients[0],
        role: sample.role,
        claimed: false,
      });
    } finally {
      setAdding(false);
    }
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
            description="Connect to check eligibility and decrypt your private allocation, tier, and vesting class."
            action={<ConnectButton />}
          />
        </div>
      ) : myAllocations.length === 0 ? (
        <div className="mt-8 space-y-4">
          <EmptyState
            icon={<ShieldCheck className="h-7 w-7" />}
            title="No allocation found for this wallet"
            description="This address isn't a recipient in any local campaign yet. For the demo, add your connected wallet to the flagship campaign to experience the decrypt flow."
            action={
              <button
                className="btn-primary"
                onClick={addMeToDemo}
                disabled={adding}
              >
                <UserPlus className="h-4 w-4" />
                {adding ? "Encrypting…" : "Add my wallet to demo campaign"}
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-8 space-y-6">
          {myAllocations.map(({ campaign, recipient }) => (
            <AllocationCard
              key={campaign.id}
              campaign={campaign}
              recipient={recipient}
              address={address!}
              decrypt={async (handle, type) => {
                const provider =
                  campaign.source === "onchain" ? realProvider : demoProvider;
                return provider.decryptValue(
                  handle,
                  campaign.tokenAddress,
                  address!,
                  type,
                );
              }}
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
  decrypt,
}: {
  campaign: CampaignRecord;
  recipient: RecipientRecord;
  address: string;
  decrypt: (handle: string, type: "euint64" | "euint8") => Promise<bigint>;
}) {
  const [claimed, setClaimed] = useState(recipient.claimed);
  const [claiming, setClaiming] = useState(false);

  const now = Math.floor(Date.now() / 1000);
  const windowOpen = now >= campaign.claimStart && now <= campaign.claimEnd;
  const canDecrypt = address.toLowerCase() === recipient.wallet.toLowerCase();

  async function handleClaim() {
    setClaiming(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
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
        subtitle={`${campaignTypeLabel(campaign.campaignType)} · You have a confidential allocation`}
        action={
          <Link href={`/public-audit/${campaign.id}`} className="btn-subtle">
            Public rules
          </Link>
        }
      />
      <CardBody className="space-y-5">
        <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-cloak-muted">
          <Lock className="h-3.5 w-3.5 shrink-0 text-gold" />
          Recipient addresses may be visible on-chain, but your allocation
          amount and tier metadata remain encrypted. Decrypt below — only your
          wallet can.
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <EncryptedField
            label="Allocation"
            handle={recipient.amountHandle}
            canDecrypt={canDecrypt}
            disabledReason="Only the recipient wallet can decrypt."
            onDecrypt={() => decrypt(recipient.amountHandle, "euint64")}
            format={(v) => formatNumber(Number(v))}
          />
          <EncryptedField
            label="Tier"
            handle={recipient.tierHandle}
            canDecrypt={canDecrypt}
            disabledReason="Only the recipient wallet can decrypt."
            onDecrypt={() => decrypt(recipient.tierHandle, "euint8")}
            format={(v) => TIER_LABELS[Number(v)] ?? `Tier ${v}`}
          />
          <EncryptedField
            label="Vesting class"
            handle={recipient.vestingHandle}
            canDecrypt={canDecrypt}
            disabledReason="Only the recipient wallet can decrypt."
            onDecrypt={() => decrypt(recipient.vestingHandle, "euint8")}
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
              {claiming ? "Claiming…" : windowOpen ? "Claim allocation" : "Claim window closed"}
            </button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}
