export interface RecipientRecord {
  wallet: string;
  amountHandle: string;
  tierHandle: string;
  vestingHandle: string;
  /** Off-chain private label (not stored on-chain in v1). Shown only to the recipient. */
  role: string;
  claimed: boolean;
}

export interface CampaignRecord {
  /** Local identifier, also used in /campaign/[id] and /public-audit/[id] URLs. */
  id: string;
  /** On-chain campaign id when this campaign was created against a live contract. */
  onChainId?: number;
  name: string;
  metadataURI?: string;
  campaignType: number;
  totalBudget: string;
  tokenAddress: string;
  admin: string;
  claimStart: number;
  claimEnd: number;
  recipients: RecipientRecord[];
  createdAt: number;
  txHash?: string;
  tokenOpsCampaignId?: string;
  tokenOpsUrl?: string;
  notes?: string;
  /** "demo" = local simulation; "onchain" = backed by a deployed contract. */
  source: "demo" | "onchain";
}

export function claimedCount(c: CampaignRecord): number {
  return c.recipients.filter((r) => r.claimed).length;
}
