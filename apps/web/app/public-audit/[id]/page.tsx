"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/empty";
import { PublicSummary } from "@/components/campaign/public-summary";
import { useCampaign, useSeedReady } from "@/lib/campaigns/hooks";
import { explorerAddress, hasLiveContractAddressNote } from "@/lib/config";
import { shortAddress } from "@/lib/utils";
import { CLOAKOPS_CONTRACT_ADDRESS } from "@/lib/config";
import {
  Eye,
  EyeOff,
  FileSearch,
  Lock,
  ShieldCheck,
} from "lucide-react";

const HIDDEN_FIELDS = [
  { label: "Allocation amount", detail: "euint64 — encrypted with Zama FHE" },
  { label: "Recipient tier", detail: "euint8 — encrypted" },
  { label: "Vesting class", detail: "euint8 — encrypted" },
  { label: "Role metadata", detail: "off-chain private label" },
];

const PUBLIC_FIELDS = [
  "Campaign name & type",
  "Total budget",
  "Number of recipients",
  "Claimed count",
  "Claim window",
  "Contract address",
];

export default function PublicAuditPage() {
  const params = useParams();
  const id = String(params.id);
  const campaign = useCampaign(id);
  const ready = useSeedReady();

  if (!campaign && !ready) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader eyebrow="Public audit" title="Loading campaign…" />
        <div className="mt-8 h-40 animate-pulse rounded-xl border border-cloak-line bg-ink-850/60" />
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <PageHeader eyebrow="Public audit" title="Campaign not found" />
        <div className="mt-8">
          <EmptyState
            icon={<FileSearch className="h-7 w-7" />}
            title={`No campaign with id "${id}"`}
            description="Create a campaign in the admin dashboard, or open the flagship demo campaign."
            action={
              <Link href="/public-audit/1" className="btn-ghost">
                Open demo campaign
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Public audit"
        title={campaign.name}
        description="Anyone can verify the campaign rules and totals. No one can see the private allocations, tiers, or vesting metadata."
        action={
          <Badge tone="gold">
            <ShieldCheck className="h-3.5 w-3.5" /> Private allocations, public rules
          </Badge>
        }
      />

      <div className="mt-6 space-y-6">
        <Card>
          <CardHeader title="Public, verifiable state" />
          <CardBody>
            <PublicSummary campaign={campaign} />
          </CardBody>
        </Card>

        {campaign.notes ? (
          <Card>
            <CardHeader title="Campaign rules & notes" />
            <CardBody>
              <p className="text-sm leading-relaxed text-cloak-muted">
                {campaign.notes}
              </p>
            </CardBody>
          </Card>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader
              title="Public fields"
              icon={<Eye className="h-4 w-4" />}
              subtitle="Verifiable by anyone"
            />
            <CardBody>
              <ul className="space-y-2 text-sm text-cloak-muted">
                {PUBLIC_FIELDS.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-cloak-info" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Hidden / encrypted fields"
              icon={<EyeOff className="h-4 w-4" />}
              subtitle="Never exposed publicly"
            />
            <CardBody>
              <ul className="space-y-2">
                {HIDDEN_FIELDS.map((f) => (
                  <li
                    key={f.label}
                    className="flex items-start gap-2 rounded-md border border-cloak-line/60 bg-ink-900/60 px-3 py-2"
                  >
                    <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold" />
                    <div>
                      <p className="text-sm text-cloak-fg">{f.label}</p>
                      <p className="text-xs text-cloak-faint">{f.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader
            title="Recipients ledger"
            subtitle="Addresses are visible; allocations stay encrypted"
          />
          <CardBody>
            <div className="overflow-hidden rounded-lg border border-cloak-line">
              <table className="w-full text-left text-xs">
                <thead className="bg-ink-800 text-cloak-muted">
                  <tr>
                    <th className="px-3 py-2 font-medium">#</th>
                    <th className="px-3 py-2 font-medium">Recipient</th>
                    <th className="px-3 py-2 font-medium">Allocation</th>
                    <th className="px-3 py-2 font-medium">Tier</th>
                    <th className="px-3 py-2 font-medium">Claimed</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.recipients.map((r, i) => (
                    <tr key={r.wallet} className="border-t border-cloak-line/60">
                      <td className="px-3 py-2 text-cloak-faint">{i + 1}</td>
                      <td className="mono px-3 py-2 text-cloak-fg">
                        {shortAddress(r.wallet, 6)}
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-gold">
                          <Lock className="h-3 w-3" /> encrypted
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1 text-gold">
                          <Lock className="h-3 w-3" /> encrypted
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {r.claimed ? (
                          <Badge tone="ok">Yes</Badge>
                        ) : (
                          <span className="text-cloak-faint">No</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Contract & TokenOps" />
          <CardBody className="space-y-3 text-sm">
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
                <span className="text-cloak-muted">{hasLiveContractAddressNote}</span>
              )}
            </Row>
            <Row label="TokenOps campaign">
              {campaign.tokenOpsUrl ? (
                <a
                  href={campaign.tokenOpsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold hover:underline"
                >
                  {campaign.tokenOpsCampaignId}
                </a>
              ) : (
                <span className="text-cloak-muted">Not synced</span>
              )}
            </Row>
            <Row label="TokenOps sync status">
              <Badge tone={campaign.tokenOpsCampaignId ? "ok" : "neutral"} dot>
                {campaign.tokenOpsCampaignId ? "Synced" : "Pending"}
              </Badge>
            </Row>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-cloak-muted">{label}</span>
      <span>{children}</span>
    </div>
  );
}
