"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAccount } from "wagmi";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/empty";
import { PublicSummary } from "@/components/campaign/public-summary";
import { TokenOpsPanel } from "@/components/tokenops/tokenops-panel";
import { useCampaign, useSeedReady } from "@/lib/campaigns/hooks";
import { findRecipient } from "@/lib/campaigns/store";
import { campaignTypeLabel, explorerAddress, CLOAKOPS_CONTRACT_ADDRESS } from "@/lib/config";
import { formatDateTime, shortAddress } from "@/lib/utils";
import {
  ArrowRight,
  FileSearch,
  KeyRound,
  Lock,
  ShieldCheck,
  UserCog,
} from "lucide-react";

export default function CampaignDetailPage() {
  const params = useParams();
  const id = String(params.id);
  const campaign = useCampaign(id);
  const { address } = useAccount();
  const ready = useSeedReady();

  if (!campaign && !ready) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeader eyebrow="Campaign" title="Loading campaign…" />
        <div className="mt-8 h-40 animate-pulse rounded-xl border border-cloak-line bg-ink-850/60" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <PageHeader eyebrow="Campaign" title="Campaign not found" />
        <div className="mt-8">
          <EmptyState
            icon={<FileSearch className="h-7 w-7" />}
            title={`No campaign with id "${id}"`}
            description="It may have been created in another browser (demo campaigns are stored locally)."
            action={
              <Link href="/admin" className="btn-ghost">
                Go to admin
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const isAdmin =
    address && address.toLowerCase() === campaign.admin.toLowerCase();
  const recipient = findRecipient(campaign, address);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow={campaignTypeLabel(campaign.campaignType)}
        title={campaign.name}
        description={campaign.notes}
        action={
          <div className="flex gap-2">
            <Link href={`/public-audit/${campaign.id}`} className="btn-ghost">
              Public audit
            </Link>
            <Link href="/claim" className="btn-subtle">
              Claim
            </Link>
          </div>
        }
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Public campaign state" />
            <CardBody>
              <PublicSummary campaign={campaign} />
            </CardBody>
          </Card>

          {/* Role-specific panel */}
          {isAdmin ? (
            <Card>
              <CardHeader
                icon={<UserCog className="h-4 w-4" />}
                title="You are the campaign admin"
                action={<Badge tone="gold">Admin</Badge>}
              />
              <CardBody className="space-y-2 text-sm text-cloak-muted">
                <p>
                  You created this campaign. You can verify all public state
                  here. Per-recipient encrypted values are decryptable only by
                  each recipient under the FHE access control.
                </p>
                <p className="mono text-xs text-cloak-faint">
                  admin {shortAddress(campaign.admin, 6)}
                </p>
              </CardBody>
            </Card>
          ) : recipient ? (
            <Card>
              <CardHeader
                icon={<KeyRound className="h-4 w-4" />}
                title="You have a confidential allocation"
                action={<Badge tone="ok" dot>Eligible</Badge>}
              />
              <CardBody className="space-y-3">
                <p className="text-sm text-cloak-muted">
                  Your allocation, tier, and vesting class are encrypted. Decrypt
                  and claim from the recipient page.
                </p>
                <Link href="/claim" className="btn-primary w-fit">
                  Decrypt & claim <ArrowRight className="h-4 w-4" />
                </Link>
              </CardBody>
            </Card>
          ) : (
            <Card>
              <CardHeader
                icon={<ShieldCheck className="h-4 w-4" />}
                title="Public viewer"
              />
              <CardBody>
                <p className="text-sm text-cloak-muted">
                  You can verify the campaign rules and totals. Allocation
                  amounts, tiers, and vesting metadata are encrypted and only
                  decryptable by their recipient.
                </p>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardHeader title="Timeline & contract" />
            <CardBody className="space-y-3 text-sm">
              <Row label="Created">{formatDateTime(Math.floor(campaign.createdAt / 1000))}</Row>
              <Row label="Claim opens">{formatDateTime(campaign.claimStart)}</Row>
              <Row label="Claim closes">{formatDateTime(campaign.claimEnd)}</Row>
              <Row label="CloakOps contract">
                {CLOAKOPS_CONTRACT_ADDRESS ? (
                  <a
                    href={explorerAddress(CLOAKOPS_CONTRACT_ADDRESS)}
                    target="_blank"
                    rel="noreferrer"
                    className="mono text-gold hover:underline"
                  >
                    {shortAddress(CLOAKOPS_CONTRACT_ADDRESS, 6)}
                  </a>
                ) : (
                  <span className="text-cloak-muted">demo (no live contract)</span>
                )}
              </Row>
              <Row label="Source">
                <Badge tone={campaign.source === "onchain" ? "ok" : "neutral"}>
                  {campaign.source === "onchain" ? "On-chain" : "Demo"}
                </Badge>
              </Row>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <TokenOpsPanel />
          <Card>
            <CardBody className="flex items-start gap-2 text-xs text-cloak-muted">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
              <span>
                {campaign.recipients.length} encrypted allocations stored.
                Recipient addresses are visible; amounts, tiers, and vesting
                classes are encrypted with Zama FHE.
              </span>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-cloak-muted">{label}</span>
      <span className="text-cloak-fg">{children}</span>
    </div>
  );
}
