"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  findRecipientAllocations,
  readConfidentialBalance,
  readRecipientEligibility,
  readRecipientHandles,
} from "@/lib/contracts/read";
import { claimOnChain } from "@/lib/contracts/write";
import { RealZamaProvider } from "@/lib/zama/real-provider";
import type { EncryptedFieldType } from "@/lib/zama/types";
import { TIER_LABELS, VESTING_LABELS } from "@/lib/sample/data";
import { CLOAKOPS_CONTRACT_ADDRESS, campaignTypeLabel } from "@/lib/config";
import { resolveOnChainClients } from "@/lib/wagmi/on-chain-clients";
import { cn, formatNumber } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";

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

  const [scanned, setScanned] = useState<
    { campaign: CampaignRecord; recipient: RecipientRecord }[]
  >([]);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    if (!address || !publicClient) return;
    setScanning(true);
    setScanError(null);
    try {
      const allocations = await findRecipientAllocations(
        publicClient,
        address as `0x${string}`,
      );
      setScanned(
        allocations.map((a) => ({
          campaign: {
            id: String(a.campaignId),
            onChainId: a.campaignId,
            name: a.campaign.name,
            campaignType: a.campaign.campaignType,
            totalBudget: a.campaign.totalBudget.toString(),
            tokenAddress: a.campaign.token,
            admin: a.campaign.admin,
            claimStart: Number(a.campaign.claimStart),
            claimEnd: Number(a.campaign.claimEnd),
            recipients: [],
            createdAt: Date.now(),
            source: "onchain",
          } satisfies CampaignRecord,
          recipient: {
            wallet: address,
            amountHandle: a.amountHandle,
            tierHandle: a.tierHandle,
            vestingHandle: a.vestingHandle,
            role: "—",
            claimed: a.claimed,
          } satisfies RecipientRecord,
        })),
      );
    } catch (e) {
      setScanError(e instanceof Error ? e.message : "On-chain scan failed.");
    } finally {
      setScanning(false);
    }
  }, [address, publicClient]);

  useEffect(() => {
    void scan();
  }, [scan]);

  // Merge local + on-chain allocations, preferring the local record (it keeps
  // the private role label). On-chain results cover wallets added in another
  // browser where nothing was saved locally.
  const allocations = useMemo(() => {
    const byId = new Map<
      string,
      { campaign: CampaignRecord; recipient: RecipientRecord }
    >();
    for (const a of scanned) byId.set(a.campaign.id, a);
    for (const a of myAllocations) {
      const onChain = byId.get(a.campaign.id);
      if (!onChain) continue;
      byId.set(a.campaign.id, {
        campaign: { ...onChain.campaign, ...a.campaign, id: onChain.campaign.id },
        recipient: { ...onChain.recipient, role: a.recipient.role },
      });
    }
    return Array.from(byId.values());
  }, [scanned, myAllocations]);

  async function decryptAt(
    handle: string,
    contractAddress: string,
    type: EncryptedFieldType,
  ): Promise<bigint> {
    if (!address || !publicClient) {
      throw new Error("Connect your wallet on Sepolia to decrypt.");
    }
    const clients = await resolveOnChainClients(address, publicClient);
    const provider = new RealZamaProvider({
      publicClient: clients.publicClient,
      walletClient: clients.walletClient,
      account: clients.account,
    });
    return provider.decryptValue(handle, contractAddress, address, type);
  }

  function decryptField(
    handle: string,
    type: EncryptedFieldType,
  ): Promise<bigint> {
    if (!CLOAKOPS_CONTRACT_ADDRESS) {
      throw new Error("Contract not configured.");
    }
    return decryptAt(handle, CLOAKOPS_CONTRACT_ADDRESS, type);
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
      ) : (
        <div className="mt-8 space-y-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-cloak-muted">
              {scanning
                ? "Scanning Sepolia for campaigns where this wallet is a recipient…"
                : `Found ${allocations.length} allocation${allocations.length === 1 ? "" : "s"} for ${address?.slice(0, 6)}…${address?.slice(-4)}`}
            </p>
            <button
              className="btn-subtle"
              onClick={() => void scan()}
              disabled={scanning}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", scanning && "animate-spin")}
              />
              Refresh
            </button>
          </div>

          {scanError ? (
            <p className="text-xs text-cloak-danger">{scanError}</p>
          ) : null}

          {scanning && allocations.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-cloak-line bg-ink-900/40 px-6 py-12 text-center">
              <Loader2 className="mb-3 h-7 w-7 animate-spin text-gold" />
              <p className="text-sm font-medium text-cloak-fg">
                Checking your eligibility on-chain
              </p>
            </div>
          ) : allocations.length === 0 ? (
            <EmptyState
              icon={<ShieldCheck className="h-7 w-7" />}
              title="No allocation found for this wallet"
              description="This wallet isn't a recipient of any campaign on the contract. Ask the campaign admin to add your address, then refresh."
              action={
                <Link href="/public-audit" className="btn-subtle">
                  View public campaigns
                </Link>
              }
            />
          ) : (
            allocations.map(({ campaign, recipient }) => (
              <AllocationCard
                key={`${campaign.id}-${recipient.wallet}`}
                campaign={campaign}
                recipient={recipient}
                address={address!}
                publicClient={publicClient}
                decrypt={(handle, type) => decryptField(handle, type)}
                decryptAt={decryptAt}
              />
            ))
          )}
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
  decryptAt,
}: {
  campaign: CampaignRecord;
  recipient: RecipientRecord;
  address: string;
  publicClient?: PublicClient;
  decrypt: (handle: string, type: EncryptedFieldType) => Promise<bigint>;
  decryptAt: (
    handle: string,
    contractAddress: string,
    type: EncryptedFieldType,
  ) => Promise<bigint>;
}) {
  const [claimed, setClaimed] = useState(recipient.claimed);
  const [claiming, setClaiming] = useState(false);
  const [handles, setHandles] = useState({
    amount: recipient.amountHandle,
    tier: recipient.tierHandle,
    vesting: recipient.vestingHandle,
  });
  const [balanceHandle, setBalanceHandle] = useState<string | null>(null);
  const tokenAddress = campaign.tokenAddress as `0x${string}` | "";

  const loadBalance = useCallback(() => {
    if (!publicClient || !tokenAddress) return;
    readConfidentialBalance(
      publicClient,
      tokenAddress,
      address as `0x${string}`,
    )
      .then((h) => {
        if (h && /^0x0*$/.test(h) === false) setBalanceHandle(h);
      })
      .catch(() => {});
  }, [publicClient, tokenAddress, address]);

  useEffect(() => {
    if (claimed) loadBalance();
  }, [claimed, loadBalance]);

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
      // Give the relayer a moment, then load the freshly credited balance.
      setTimeout(loadBalance, 1500);
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

        {claimed && balanceHandle && tokenAddress ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-cloak-ok/20 bg-cloak-ok/5 p-3 text-xs text-cloak-muted">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-cloak-ok" />
              Your allocation was credited to your confidential token balance via
              an on-chain <span className="text-cloak-fg">FHE.add</span>. The payout
              amount stays encrypted — only you can decrypt it.
            </div>
            <EncryptedField
              label="Confidential token balance"
              handle={balanceHandle}
              canDecrypt={canDecrypt}
              disabledReason="Only the recipient wallet can decrypt."
              onDecrypt={() => decryptAt(balanceHandle, tokenAddress, "euint64")}
              format={(v) => formatNumber(Number(v))}
            />
          </div>
        ) : null}

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
