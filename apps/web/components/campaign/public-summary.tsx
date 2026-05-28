import { Stat } from "@/components/ui/stat";
import { Badge } from "@/components/ui/badge";
import { campaignTypeLabel, explorerAddress } from "@/lib/config";
import { formatDateTime, formatNumber, shortAddress } from "@/lib/utils";
import { claimedCount, type CampaignRecord } from "@/lib/campaigns/types";
import {
  CalendarClock,
  Coins,
  ExternalLink,
  Users,
  CheckCircle2,
} from "lucide-react";

export function PublicSummary({ campaign }: { campaign: CampaignRecord }) {
  const claimed = claimedCount(campaign);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Total budget"
          value={formatNumber(Number(campaign.totalBudget))}
          hint="Public"
          icon={<Coins className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Recipients"
          value={campaign.recipients.length}
          hint="Public count"
          icon={<Users className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Claimed"
          value={`${claimed} / ${campaign.recipients.length}`}
          hint="Public"
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
        />
        <Stat
          label="Type"
          value={campaignTypeLabel(campaign.campaignType)}
          icon={<CalendarClock className="h-3.5 w-3.5" />}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-cloak-line bg-ink-900/50 p-4">
          <p className="label">Claim window</p>
          <p className="mt-1 text-sm text-cloak-fg">
            {formatDateTime(campaign.claimStart)}
          </p>
          <p className="text-xs text-cloak-muted">
            to {formatDateTime(campaign.claimEnd)}
          </p>
        </div>
        <div className="rounded-lg border border-cloak-line bg-ink-900/50 p-4">
          <p className="label">Token</p>
          <a
            href={explorerAddress(campaign.tokenAddress)}
            target="_blank"
            rel="noreferrer"
            className="mono mt-1 flex items-center gap-1 text-sm text-cloak-fg hover:text-gold"
          >
            {shortAddress(campaign.tokenAddress, 6)}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={campaign.source === "onchain" ? "ok" : "neutral"} dot>
          {campaign.source === "onchain" ? "On-chain" : "Demo campaign"}
        </Badge>
        {campaign.tokenOpsCampaignId ? (
          <Badge tone="gold">
            TokenOps · {campaign.tokenOpsCampaignId.slice(0, 12)}…
          </Badge>
        ) : null}
        {campaign.txHash ? (
          <span className="mono text-xs text-cloak-faint">
            tx {shortAddress(campaign.txHash, 6)}
          </span>
        ) : null}
      </div>
    </div>
  );
}
