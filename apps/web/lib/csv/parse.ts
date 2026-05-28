import Papa from "papaparse";
import { isAddress } from "viem";

export interface ParsedRecipient {
  wallet: string;
  allocation: number;
  tier: number;
  vestingClass: number;
  role: string;
}

export interface CsvParseResult {
  recipients: ParsedRecipient[];
  errors: string[];
  totalAllocation: number;
}

const MAX_EUINT64 = 18446744073709551615n;

/**
 * Parse a CloakOps allocation CSV:
 *   wallet,allocation,tier,vestingClass,role
 * Allocations / tiers / vesting are validated for FHE encoding (euint64 / euint8).
 */
export function parseAllocationCsv(input: string): CsvParseResult {
  const errors: string[] = [];
  const recipients: ParsedRecipient[] = [];

  const parsed = Papa.parse<Record<string, string>>(input.trim(), {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  if (parsed.errors.length) {
    for (const e of parsed.errors) {
      errors.push(`Row ${e.row ?? "?"}: ${e.message}`);
    }
  }

  const seen = new Set<string>();

  parsed.data.forEach((row, i) => {
    const line = i + 2; // header is line 1
    const wallet = (row.wallet ?? "").trim();
    const allocationRaw = (row.allocation ?? "").trim();
    const tierRaw = (row.tier ?? "").trim();
    const vestingRaw = (row.vestingclass ?? row.vesting ?? "").trim();
    const role = (row.role ?? "").trim() || "recipient";

    if (!wallet && !allocationRaw) return; // skip blank-ish rows

    if (!isAddress(wallet)) {
      errors.push(`Line ${line}: invalid wallet address "${wallet}".`);
      return;
    }
    const walletKey = wallet.toLowerCase();
    if (seen.has(walletKey)) {
      errors.push(`Line ${line}: duplicate wallet ${wallet}.`);
      return;
    }

    const allocation = Number(allocationRaw);
    if (!Number.isFinite(allocation) || allocation < 0 || !Number.isInteger(allocation)) {
      errors.push(`Line ${line}: allocation must be a non-negative integer.`);
      return;
    }
    if (BigInt(allocation) > MAX_EUINT64) {
      errors.push(`Line ${line}: allocation exceeds euint64 capacity.`);
      return;
    }

    const tier = Number(tierRaw);
    if (!Number.isInteger(tier) || tier < 0 || tier > 255) {
      errors.push(`Line ${line}: tier must be an integer 0-255 (euint8).`);
      return;
    }

    const vestingClass = Number(vestingRaw);
    if (!Number.isInteger(vestingClass) || vestingClass < 0 || vestingClass > 255) {
      errors.push(`Line ${line}: vestingClass must be an integer 0-255 (euint8).`);
      return;
    }

    seen.add(walletKey);
    recipients.push({ wallet, allocation, tier, vestingClass, role });
  });

  const totalAllocation = recipients.reduce((sum, r) => sum + r.allocation, 0);

  return { recipients, errors, totalAllocation };
}
