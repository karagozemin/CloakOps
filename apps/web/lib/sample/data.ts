/** Sample campaign for the admin CSV loader (Sepolia). */
export const SAMPLE_CAMPAIGN = {
  name: "AI x Crypto Seed Contributors",
  campaignType: 0,
  totalBudget: "1000000",
  notes:
    "A startup distributing 1,000,000 tokens across investors, advisors, and contributors. The public can verify the rules and total budget, but no party can see another's allocation size, tier, or vesting class.",
  claimWindowDays: 60,
} as const;

export const SAMPLE_CSV = `wallet,allocation,tier,vestingClass,role
0x1111111111111111111111111111111111111111,25000,2,1,contributor
0x2222222222222222222222222222222222222222,75000,3,2,core-contributor
0x3333333333333333333333333333333333333333,150000,4,3,advisor
0x4444444444444444444444444444444444444444,300000,5,4,angel-investor
0x5555555555555555555555555555555555555555,450000,5,4,strategic-investor
`;

export const TIER_LABELS: Record<number, string> = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
  4: "Tier 4",
  5: "Tier 5",
};

export const VESTING_LABELS: Record<number, string> = {
  1: "Class 1 · 6mo cliff, 18mo linear",
  2: "Class 2 · 12mo cliff, 24mo linear",
  3: "Class 3 · 12mo cliff, 36mo linear",
  4: "Class 4 · 18mo cliff, 36mo linear",
};

/**
 * Named presets — one-click, sample-data-filled starting points for the admin.
 * Each preset maps to an on-chain campaign type and comes pre-loaded with a
 * realistic CSV so a judge can create a campaign in a single click. `campaignType`
 * matches the CAMPAIGN_TYPES enum order in `lib/config.ts`.
 */
export type CampaignPreset = {
  key: string;
  label: string;
  tagline: string;
  campaignType: number;
  totalBudget: string;
  claimWindowDays: number;
  notes: string;
  csv: string;
};

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    key: "investor-round",
    label: "Investor round",
    tagline: "Seed / strategic — big tickets, long vesting",
    campaignType: 0,
    totalBudget: "2000000",
    claimWindowDays: 90,
    notes:
      "Strategic + angel round. The public verifies the round size (2,000,000) and vesting rules, but no investor can see another's ticket size, tier, or vesting class.",
    csv: `wallet,allocation,tier,vestingClass,role
0x1111111111111111111111111111111111111111,250000,4,3,angel-investor
0x2222222222222222222222222222222222222222,500000,5,4,strategic-investor
0x3333333333333333333333333333333333333333,600000,5,4,lead-investor
0x4444444444444444444444444444444444444444,650000,5,4,strategic-investor
`,
  },
  {
    key: "team-payout",
    label: "Team payout",
    tagline: "Core team salaries + equity-style grants",
    campaignType: 1,
    totalBudget: "800000",
    claimWindowDays: 45,
    notes:
      "Core team grant. Everyone can confirm the total team budget and cliff rules, but individual salaries stay encrypted — no teammate sees another's package.",
    csv: `wallet,allocation,tier,vestingClass,role
0x1111111111111111111111111111111111111111,120000,3,2,engineer
0x2222222222222222222222222222222222222222,180000,4,2,senior-engineer
0x3333333333333333333333333333333333333333,220000,5,3,founding-engineer
0x4444444444444444444444444444444444444444,280000,5,3,team-lead
`,
  },
  {
    key: "community-rewards",
    label: "Community rewards",
    tagline: "Airdrop / contributor rewards — many wallets",
    campaignType: 3,
    totalBudget: "500000",
    claimWindowDays: 30,
    notes:
      "Community distribution. The rules and total are public; each recipient's reward tier stays private so leaderboards can't be reverse-engineered from on-chain amounts.",
    csv: `wallet,allocation,tier,vestingClass,role
0x1111111111111111111111111111111111111111,40000,2,1,contributor
0x2222222222222222222222222222222222222222,60000,2,1,contributor
0x3333333333333333333333333333333333333333,90000,3,1,power-user
0x4444444444444444444444444444444444444444,120000,3,2,ambassador
0x5555555555555555555555555555555555555555,190000,4,2,core-contributor
`,
  },
  {
    key: "advisor-vesting",
    label: "Advisor vesting",
    tagline: "Advisor grants on staggered cliffs",
    campaignType: 2,
    totalBudget: "600000",
    claimWindowDays: 60,
    notes:
      "Advisor grants. The public sees the advisory budget and vesting schedule classes; each advisor's grant size and tier stay confidential.",
    csv: `wallet,allocation,tier,vestingClass,role
0x1111111111111111111111111111111111111111,120000,3,2,advisor
0x2222222222222222222222222222222222222222,180000,4,3,advisor
0x3333333333333333333333333333333333333333,300000,5,4,lead-advisor
`,
  },
];
