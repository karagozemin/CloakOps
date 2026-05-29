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
