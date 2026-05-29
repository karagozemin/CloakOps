import { cn, formatNumber } from "@/lib/utils";
import { getBudgetCheck } from "@/lib/csv/budget-check";
import { AlertTriangle, CheckCircle2, Lock } from "lucide-react";

export function BudgetChecksum({
  totalAllocation,
  budget,
  recipientCount,
  className,
}: {
  totalAllocation: number;
  budget: number;
  recipientCount: number;
  className?: string;
}) {
  const { status, remainder } = getBudgetCheck(totalAllocation, budget);

  if (status === "idle") return null;

  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs",
        status === "verified" &&
          "border-cloak-ok/40 bg-cloak-ok/10",
        status === "under" &&
          "border-gold/30 bg-gold/5",
        status === "over" &&
          "border-cloak-danger/40 bg-cloak-danger/10",
        className,
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-cloak-fg">
            {status === "verified" ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-cloak-ok" />
                Verifiable sum — allocations match public budget
              </>
            ) : status === "under" ? (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-gold" />
                Allocations below public budget
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-cloak-danger" />
                Allocations exceed public budget
              </>
            )}
          </p>
          <p className="text-cloak-muted">
            Σ allocations ({formatNumber(totalAllocation)}) vs public budget (
            {formatNumber(budget)}) across {recipientCount} recipient
            {recipientCount === 1 ? "" : "s"}. Checked before Zama encryption —
            individual amounts stay private on-chain.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="chip">
            <Lock className="h-3 w-3 text-gold" />
            Σ {formatNumber(totalAllocation)}
          </span>
          <span className="chip">Budget {formatNumber(budget)}</span>
          {status === "verified" ? (
            <span className="chip border-cloak-ok/40 text-cloak-ok">Match</span>
          ) : (
            <span
              className={cn(
                "chip",
                status === "over"
                  ? "border-cloak-danger/40 text-cloak-danger"
                  : "border-gold/40 text-gold",
              )}
            >
              Δ {formatNumber(remainder)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
