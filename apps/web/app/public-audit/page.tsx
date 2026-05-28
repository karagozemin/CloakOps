"use client";

import Link from "next/link";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/empty";
import { useCampaigns } from "@/lib/campaigns/hooks";
import { campaignTypeLabel } from "@/lib/config";
import { formatNumber } from "@/lib/utils";
import { claimedCount } from "@/lib/campaigns/types";
import { ArrowRight, FileSearch, Lock, ShieldCheck, Users } from "lucide-react";

export default function PublicAuditIndexPage() {
  const campaigns = useCampaigns();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Public audit"
        title="Confidential campaigns"
        description="Anyone can verify campaign rules and totals. Allocation amounts, tiers, and vesting stay encrypted with Zama FHE."
        action={
          <Badge tone="gold">
            <ShieldCheck className="h-3.5 w-3.5" /> Private allocations, public rules
          </Badge>
        }
      />

      <div className="mt-6">
        {campaigns.length === 0 ? (
          <EmptyState
            icon={<FileSearch className="h-7 w-7" />}
            title="No campaigns yet"
            description="Create a confidential campaign in the admin dashboard on Sepolia to see it here."
            action={
              <Link href="/admin" className="btn-primary">
                Create campaign
              </Link>
            }
          />
        ) : (
          <div className="space-y-3">
            {campaigns.map((c) => {
              const claimed = claimedCount(c);
              return (
                <Link key={c.id} href={`/public-audit/${c.id}`} className="block">
                  <Card className="transition-colors hover:border-gold/40">
                    <CardBody className="flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-cloak-fg">
                            {c.name}
                          </h3>
                          <Badge tone="ok" dot>
                            #{c.onChainId ?? c.id}
                          </Badge>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-cloak-muted">
                          <span>{campaignTypeLabel(c.campaignType)}</span>
                          <span className="inline-flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {c.recipients.length} recipients
                          </span>
                          <span className="inline-flex items-center gap-1 text-gold">
                            <Lock className="h-3 w-3" />
                            {formatNumber(Number(c.totalBudget))} budget
                          </span>
                          <span>
                            {claimed} / {c.recipients.length} claimed
                          </span>
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 shrink-0 text-cloak-muted" />
                    </CardBody>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
