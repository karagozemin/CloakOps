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
import { DemoZamaProvider } from "@/lib/zama/demo-provider";
import { RealZamaProvider } from "@/lib/zama/real-provider";
import type { EncryptedFieldType } from "@/lib/zama/types";
import { TIER_LABELS, VESTING_LABELS } from "@/lib/demo/data";
import {
  campaignTypeLabel,
  CLOAKOPS_CONTRACT_ADDRESS,
  ZAMA_MODE,
} from "@/lib/config";
import { resolveOnChainClients } from "@/lib/wagmi/on-chain-clients";
import { cn, formatNumber } from "@/lib/utils";
import {
  CheckCircle2,
  Lock,
  ShieldCheck,
  UserPlus,
  Wallet,
} from "lucide-react";

const demoProvider = new DemoZamaProvider();

export default function ClaimPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const campaigns = useCampaigns();
  const [adding, setAdding] = useState(false);

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
    if (!address || ZAMA_MODE === "real") return;
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

  async function decryptField(
    campaign: CampaignRecord,
    handle: string,
    type: EncryptedFieldType,
  ): Promise<bigint> {
    if (!address) {
      throw new Error("Connect your wallet to decrypt.");
    }

    if (campaign.source === "onchain") {
      if (!publicClient || !CLOAKOPS_CONTRACT_ADDRESS) {
        throw new Error("On-chain decrypt requires a connected Sepolia client.");
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

    return demoProvider.decryptValue(handle, campaign.tokenAddress, address, type);
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
            description={
              ZAMA_MODE === "real"
                ? "Your wallet must be listed in the admin CSV when the campaign is created on-chain. Ask the campaign admin to add your address, then create the campaign again from /admin."
                : "This address isn't a recipient in any local campaign yet. For the demo, add your connected wallet to the flagship campaign to experience the decrypt flow."
            }
            action={
              ZAMA_MODE === "real" ? (
                <Link href="/admin" className="btn-primary">
                  Go to admin
                </Link>
              ) : (
                <button
                  className="btn-primary"
                  onClick={addMeToDemo}
                  disabled={adding}
                >
                  <UserPlus className="h-4 w-4" />
                  {adding ? "Encrypting…" : "Add my wallet to demo campaign"}
                </button>
              )
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
              decrypt={(handle, type) => decryptField(campaign, handle, type)}
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

  const isDemoRecipient =
    campaign.source !== "onchain" ||
    recipient.amountHandle.startsWith("0xa1") ||
    recipient.amountHandle.startsWith("0xb2");

  useEffect(() => {
    if (
      campaign.source !== "onchain" ||
      !publicClient ||
      !campaign.onChainId ||
      isDemoRecipient
    ) {
      return;
    }

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
      .catch(() => {
        /* keep local handles as fallback */
      });

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
  }, [
    campaign.source,
    campaign.onChainId,
    publicClient,
    address,
    isDemoRecipient,
    recipient.amountHandle,
  ]);

  const now = Math.floor(Date.now() / 1000);
  const windowOpen = now >= campaign.claimStart && now <= campaign.claimEnd;
  const canDecrypt = address.toLowerCase() === recipient.wallet.toLowerCase();

  async function handleClaim() {
    setClaiming(true);
    try {
      if (
        campaign.source === "onchain" &&
        publicClient &&
        campaign.onChainId
      ) {
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
      } else {
        await new Promise((r) => setTimeout(r, 700));
      }
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
        {isDemoRecipient && campaign.source === "onchain" ? (
          <div className="rounded-lg border border-cloak-warn/30 bg-cloak-warn/10 p-3 text-xs text-cloak-warn">
            This entry uses demo-only handles (added via “Add my wallet”). Real
            decrypt requires your wallet in the admin CSV at campaign creation.
            Create a new campaign from /admin with your address included.
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-cloak-muted">
          <Lock className="h-3.5 w-3.5 shrink-0 text-gold" />
          Recipient addresses may be visible on-chain, but your allocation
          amount and tier metadata remain encrypted. Decrypt below — only your
          wallet can.
          {campaign.source === "onchain" ? (
            <span className="ml-1 text-gold">On-chain FHE handles.</span>
          ) : (
            <span className="ml-1">Demo mode handles.</span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <EncryptedField
            label="Allocation"
            handle={handles.amount}
            canDecrypt={canDecrypt && !isDemoRecipient}
            disabledReason={
              isDemoRecipient
                ? "Demo handles are not valid on-chain. Re-create the campaign with your wallet in the CSV."
                : "Only the recipient wallet can decrypt."
            }
            onDecrypt={() => decrypt(handles.amount, "euint64")}
            format={(v) => formatNumber(Number(v))}
          />
          <EncryptedField
            label="Tier"
            handle={handles.tier}
            canDecrypt={canDecrypt && !isDemoRecipient}
            disabledReason={
              isDemoRecipient
                ? "Demo handles are not valid on-chain. Re-create the campaign with your wallet in the CSV."
                : "Only the recipient wallet can decrypt."
            }
            onDecrypt={() => decrypt(handles.tier, "euint8")}
            format={(v) => TIER_LABELS[Number(v)] ?? `Tier ${v}`}
          />
          <EncryptedField
            label="Vesting class"
            handle={handles.vesting}
            canDecrypt={canDecrypt && !isDemoRecipient}
            disabledReason={
              isDemoRecipient
                ? "Demo handles are not valid on-chain. Re-create the campaign with your wallet in the CSV."
                : "Only the recipient wallet can decrypt."
            }
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
              disabled={claiming || !windowOpen || isDemoRecipient}
              title={
                isDemoRecipient
                  ? "Re-create the campaign with your wallet in the admin CSV."
                  : !windowOpen
                    ? "Claim window is not open."
                    : undefined
              }
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
