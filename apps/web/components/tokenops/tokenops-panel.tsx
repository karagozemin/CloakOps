"use client";

import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useTokenOps } from "@/lib/tokenops/context";
import { cn, shortAddress } from "@/lib/utils";
import {
  Activity,
  CheckCircle2,
  Info,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { TokenOpsLogLevel } from "@/lib/tokenops/types";

const levelIcon: Record<TokenOpsLogLevel, React.ReactNode> = {
  info: <Info className="h-3.5 w-3.5 text-cloak-info" />,
  success: <CheckCircle2 className="h-3.5 w-3.5 text-cloak-ok" />,
  warn: <TriangleAlert className="h-3.5 w-3.5 text-cloak-warn" />,
  error: <XCircle className="h-3.5 w-3.5 text-cloak-danger" />,
};

export function TokenOpsPanel({ className }: { className?: string }) {
  const { status, statusLoading, mode, log, refreshStatus } = useTokenOps();
  const connected = status?.connected ?? false;

  return (
    <Card className={className}>
      <CardHeader
        icon={<Activity className="h-4 w-4" />}
        title="TokenOps integration"
        subtitle="Confidential distribution lifecycle rail"
        action={
          <button
            className="btn-subtle"
            onClick={() => void refreshStatus()}
            disabled={statusLoading}
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", statusLoading && "animate-spin")}
            />
          </button>
        }
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Mode">
            <Badge tone={mode === "real" ? "gold" : "neutral"}>
              {mode === "real" ? "Real SDK" : "Demo adapter"}
            </Badge>
          </Field>
          <Field label="Connection">
            <Badge tone={connected ? "ok" : statusLoading ? "neutral" : "warn"} dot>
              {statusLoading ? "Probing…" : connected ? "Connected" : "Standby"}
            </Badge>
          </Field>
          <Field label="Provider">
            <span className="text-xs text-cloak-fg">
              {status?.provider ?? "—"}
            </span>
          </Field>
          <Field label="SDK version">
            <span className="mono text-xs text-cloak-fg">
              {status?.sdkVersion ?? "—"}
            </span>
          </Field>
          {status?.factoryAddress ? (
            <Field label="Factory">
              <span className="mono text-xs text-cloak-fg">
                {shortAddress(status.factoryAddress, 5)}
              </span>
            </Field>
          ) : null}
          {typeof status?.latencyMs === "number" ? (
            <Field label="Latency">
              <span className="mono text-xs text-cloak-fg">
                {status.latencyMs}ms
              </span>
            </Field>
          ) : null}
        </div>

        {status?.message ? (
          <p className="rounded-lg border border-cloak-line bg-ink-900 px-3 py-2 text-xs text-cloak-muted">
            {status.message}
          </p>
        ) : null}

        <div>
          <p className="label mb-2">Operation log</p>
          <div className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {log.length === 0 ? (
              <p className="rounded-lg border border-dashed border-cloak-line px-3 py-4 text-center text-xs text-cloak-faint">
                No TokenOps operations yet.
              </p>
            ) : (
              log.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-2 rounded-md border border-cloak-line/60 bg-ink-900/60 px-2.5 py-1.5"
                >
                  <span className="mt-0.5">{levelIcon[entry.level]}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-cloak-fg">{entry.message}</p>
                    <p className="mono text-[10px] text-cloak-faint">
                      {new Date(entry.ts).toLocaleTimeString()} · {entry.op}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="label">{label}</p>
      <div>{children}</div>
    </div>
  );
}
