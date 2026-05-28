import type { ParsedRecipient } from "@/lib/csv/parse";

/** The flagship demo campaign described in the CloakOps brief. */
export const DEMO_CAMPAIGN = {
  name: "AI x Crypto Seed Contributors",
  campaignType: 0, // Private Round
  totalBudget: "1000000",
  notes:
    "A startup distributing 1,000,000 tokens across investors, advisors, and contributors. The public can verify the rules and total budget, but no party can see another's allocation size, tier, or vesting class.",
  // 60-day claim window starting now (set at seed time).
  claimWindowDays: 60,
} as const;

export const DEMO_TOKEN_ADDRESS =
  "0x5555000000000000000000000000000000005555";

export const DEMO_RECIPIENTS: ParsedRecipient[] = [
  {
    wallet: "0x1111111111111111111111111111111111111111",
    allocation: 25000,
    tier: 2,
    vestingClass: 1,
    role: "contributor",
  },
  {
    wallet: "0x2222222222222222222222222222222222222222",
    allocation: 75000,
    tier: 3,
    vestingClass: 2,
    role: "core-contributor",
  },
  {
    wallet: "0x3333333333333333333333333333333333333333",
    allocation: 150000,
    tier: 4,
    vestingClass: 3,
    role: "advisor",
  },
  {
    wallet: "0x4444444444444444444444444444444444444444",
    allocation: 300000,
    tier: 5,
    vestingClass: 4,
    role: "angel-investor",
  },
  {
    wallet: "0x5555555555555555555555555555555555555555",
    allocation: 450000,
    tier: 5,
    vestingClass: 4,
    role: "strategic-investor",
  },
];

export const DEMO_CSV = `wallet,allocation,tier,vestingClass,role
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
