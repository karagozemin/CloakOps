export type BudgetCheckStatus = "idle" | "over" | "under" | "verified";

export function getBudgetCheck(
  totalAllocation: number,
  budget: number,
): { status: BudgetCheckStatus; remainder: number } {
  if (budget <= 0 || totalAllocation <= 0) {
    return { status: "idle", remainder: 0 };
  }
  if (totalAllocation > budget) {
    return { status: "over", remainder: totalAllocation - budget };
  }
  if (totalAllocation < budget) {
    return { status: "under", remainder: budget - totalAllocation };
  }
  return { status: "verified", remainder: 0 };
}
