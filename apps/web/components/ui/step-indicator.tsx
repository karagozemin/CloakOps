import { cn } from "@/lib/utils";
import { Check, Loader2 } from "lucide-react";

export type StepStatus = "pending" | "active" | "done" | "error";

export interface Step {
  key: string;
  label: string;
  description?: string;
}

export function StepIndicator({
  steps,
  statuses,
}: {
  steps: Step[];
  statuses: Record<string, StepStatus>;
}) {
  return (
    <ol className="space-y-3">
      {steps.map((step, i) => {
        const status = statuses[step.key] ?? "pending";
        return (
          <li key={step.key} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                  status === "done" &&
                    "border-cloak-ok/40 bg-cloak-ok/15 text-cloak-ok",
                  status === "active" &&
                    "border-gold/50 bg-gold/15 text-gold",
                  status === "error" &&
                    "border-cloak-danger/40 bg-cloak-danger/15 text-cloak-danger",
                  status === "pending" &&
                    "border-cloak-line bg-ink-800 text-cloak-faint",
                )}
              >
                {status === "done" ? (
                  <Check className="h-3.5 w-3.5" />
                ) : status === "active" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  i + 1
                )}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    "mt-1 h-full min-h-[14px] w-px",
                    status === "done" ? "bg-cloak-ok/40" : "bg-cloak-line",
                  )}
                />
              ) : null}
            </div>
            <div className="pb-2">
              <p
                className={cn(
                  "text-sm font-medium",
                  status === "pending" ? "text-cloak-muted" : "text-cloak-fg",
                )}
              >
                {step.label}
              </p>
              {step.description ? (
                <p className="text-xs text-cloak-muted">{step.description}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
