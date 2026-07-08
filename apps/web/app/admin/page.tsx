"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, usePublicClient } from "wagmi";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/ui/empty";
import { StepIndicator, type StepStatus } from "@/components/ui/step-indicator";
import { TokenOpsPanel } from "@/components/tokenops/tokenops-panel";
import { CsvEditor } from "@/components/admin/csv-editor";
import { RecipientBuilder } from "@/components/admin/recipient-builder";
import { BudgetChecksum } from "@/components/admin/budget-checksum";
import { SignatureSavings } from "@/components/admin/signature-savings";
import { CopyLink } from "@/components/ui/copy-link";
import { ErrorNotice, WrongNetworkBanner } from "@/components/ui/error-notice";

import { useZama } from "@/lib/zama";
import { useTokenOps } from "@/lib/tokenops/context";
import { parseAllocationCsv, type CsvParseResult } from "@/lib/csv/parse";
import { getBudgetCheck } from "@/lib/csv/budget-check";
import {
  runCreateCampaign,
  type FlowStepKey,
  type FlowStepStatus,
} from "@/lib/campaigns/create-flow";
import type { CampaignRecord } from "@/lib/campaigns/types";
import {
  CAMPAIGN_TYPES,
  CHAIN_ID,
  CLOAKOPS_CONTRACT_ADDRESS,
  CLOAKOPS_TOKEN_ADDRESS,
} from "@/lib/config";
import { resolveOnChainClients } from "@/lib/wagmi/on-chain-clients";
import {
  SAMPLE_CAMPAIGN,
  SAMPLE_CSV,
  CAMPAIGN_PRESETS,
  type CampaignPreset,
} from "@/lib/sample/data";

import { cn, formatNumber, shortAddress, toUnixSeconds } from "@/lib/utils";
import {
  ArrowRight,
  EyeOff,
  FileUp,
  Lock,
  Sparkles,
  Upload,
} from "lucide-react";

const STEPS = [
  {
    key: "parse",
    label: "CSV parsed & validated",
    description:
      "We read your recipients, check every address, and sum allocations against the public budget — no signature needed.",
  },
  {
    key: "encrypt",
    label: "Zama FHE encryption",
    description:
      "Each amount, tier, and vesting class is encrypted in your browser. Signature 1 authorizes the encrypted batch.",
  },
  {
    key: "submit",
    label: "Confidential contract submission",
    description:
      "All recipients are written on-chain in one Multicall3 batch. Signature 2 sends it — that's the last signature, no matter the list size.",
  },
  {
    key: "tokenops",
    label: "TokenOps campaign synced",
    description:
      "Encrypted allocations flow into TokenOps vesting wallets automatically — no extra clicks from you.",
  },
  {
    key: "ready",
    label: "Campaign ready",
    description:
      "Recipients can claim privately and anyone can verify the public rules on the audit page.",
  },
];


function defaultLocalDateTime(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86400_000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { provider: zama, status: zamaStatus } = useZama();
  const tokenops = useTokenOps();

  const [name, setName] = useState("");
  const [campaignType, setCampaignType] = useState(0);
  const [totalBudget, setTotalBudget] = useState("");
  const [tokenAddress, setTokenAddress] = useState<string>(CLOAKOPS_TOKEN_ADDRESS);
  const [claimStart, setClaimStart] = useState(defaultLocalDateTime(0));
  const [claimEnd, setClaimEnd] = useState(defaultLocalDateTime(60));
  const [notes, setNotes] = useState("");
  const [csvText, setCsvText] = useState("");
  const [recipientMode, setRecipientMode] = useState<"form" | "csv">("form");

  const [statuses, setStatuses] = useState<Record<string, StepStatus>>({});
  const [stepDetails, setStepDetails] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CampaignRecord | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const parseResult: CsvParseResult | null = useMemo(
    () => (csvText.trim() ? parseAllocationCsv(csvText) : null),
    [csvText],
  );

  const budgetNum = Number(totalBudget || 0);
  const budgetCheck = parseResult
    ? getBudgetCheck(parseResult.totalAllocation, budgetNum)
    : null;
  const overBudget = budgetCheck?.status === "over";

  function loadSampleCsv() {
    setName(SAMPLE_CAMPAIGN.name);
    setCampaignType(SAMPLE_CAMPAIGN.campaignType);
    setTotalBudget(SAMPLE_CAMPAIGN.totalBudget);
    setTokenAddress(CLOAKOPS_TOKEN_ADDRESS);
    setNotes(SAMPLE_CAMPAIGN.notes);
    setClaimStart(defaultLocalDateTime(0));
    setClaimEnd(defaultLocalDateTime(SAMPLE_CAMPAIGN.claimWindowDays));
    setCsvText(SAMPLE_CSV);
    setCreated(null);
    setStatuses({});
  }

  function loadPreset(preset: CampaignPreset) {
    setName(preset.label);
    setCampaignType(preset.campaignType);
    setTotalBudget(preset.totalBudget);
    setTokenAddress(CLOAKOPS_TOKEN_ADDRESS);
    setNotes(preset.notes);
    setClaimStart(defaultLocalDateTime(0));
    setClaimEnd(defaultLocalDateTime(preset.claimWindowDays));
    setCsvText(preset.csv);
    setRecipientMode("csv");
    setCreated(null);
    setStatuses({});
    setFormError(null);
  }


  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvText(await file.text());
  }

  function validate(): string | null {
    if (!name.trim()) return "Campaign name is required.";
    if (!totalBudget || budgetNum <= 0) return "Enter a public total budget.";
    if (!tokenAddress.trim()) return "Enter a token address.";
    if (!parseResult || parseResult.recipients.length === 0)
      return "Add at least one recipient via CSV.";
    if (parseResult.errors.length > 0)
      return "Fix the CSV validation errors first.";
    if (!isConnected) {
      return "Connect your wallet on Sepolia (on-chain txs + FHE).";
    }
    if (chainId !== CHAIN_ID) {
      return `Switch your wallet to Sepolia (chain ${CHAIN_ID}) before creating.`;
    }
    if (!CLOAKOPS_CONTRACT_ADDRESS) {
      return "NEXT_PUBLIC_CLOAKOPS_CONTRACT_ADDRESS is not configured.";
    }
    if (toUnixSeconds(claimEnd) <= toUnixSeconds(claimStart))
      return "Claim end must be after claim start.";
    return null;
  }

  async function handleCreate() {
    const err = validate();
    if (err) {
      setFormError(err);
      return;
    }
    setFormError(null);
    setStepDetails({});
    setCreating(true);
    setCreated(null);
    setStatuses({ parse: "active" });

    const onStep = (
      key: FlowStepKey,
      status: FlowStepStatus,
      detail?: string,
    ) => {
      setStatuses((prev) => ({ ...prev, [key]: status }));
      if (detail) {
        setStepDetails((prev) => ({ ...prev, [key]: detail }));
      }
    };

    try {
      if (!publicClient || !address) {
        throw new Error("Connect your wallet on Sepolia.");
      }
      const onChain = await resolveOnChainClients(address, publicClient);

      const record = await runCreateCampaign({
        input: {
          name: name.trim(),
          metadataURI: "ipfs://cloakops-campaign",
          campaignType,
          totalBudget: String(budgetNum),
          tokenAddress: tokenAddress.trim(),
          admin: address,
          claimStart: toUnixSeconds(claimStart),
          claimEnd: toUnixSeconds(claimEnd),
          notes: notes.trim() || undefined,
        },
        recipients: parseResult!.recipients,
        zama,
        tokenops,
        contractAddress: CLOAKOPS_CONTRACT_ADDRESS,
        onStep,
        onChain,
      });
      setCreated(record);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        eyebrow="Admin"
        title="Create a confidential campaign"
        description="Upload allocations, encrypt them with Zama FHE, and sync the campaign lifecycle to TokenOps. Allocation amounts, tiers, and vesting stay private; budget and rules stay public."
        action={
          <button className="btn-ghost" onClick={loadSampleCsv}>
            <Sparkles className="h-4 w-4" />
            Load sample CSV
          </button>
        }
      />

      <WrongNetworkBanner className="mt-4" />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Left: form + CSV + recipients */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Start from a preset"
              subtitle="One click fills the whole form with a realistic, ready-to-launch example"
              icon={<Sparkles className="h-4 w-4" />}
            />
            <CardBody>
              <div className="grid gap-2 sm:grid-cols-2">
                {CAMPAIGN_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="group rounded-lg border border-cloak-line bg-ink-900 px-3 py-2.5 text-left transition-colors hover:border-gold/60 hover:bg-gold/5"
                  >
                    <p className="flex items-center gap-1.5 text-sm font-medium text-cloak-fg">
                      {preset.label}
                      <ArrowRight className="h-3 w-3 text-gold opacity-0 transition-opacity group-hover:opacity-100" />
                    </p>

                    <p className="text-xs text-cloak-muted">{preset.tagline}</p>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-cloak-faint">
                Presets pre-fill everything — you still review, edit, and sign
                before anything hits the chain.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Campaign details" subtitle="Public, verifiable metadata" />

            <CardBody className="space-y-4">
              <div>
                <label className="label mb-1.5 block">Campaign name</label>
                <input
                  className="input"
                  placeholder="AI x Crypto Seed Contributors"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div>
                <label className="label mb-1.5 block">Campaign type</label>
                <div className="grid grid-cols-2 gap-2">
                  {CAMPAIGN_TYPES.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setCampaignType(t.id)}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left transition-colors",
                        campaignType === t.id
                          ? "border-gold/60 bg-gold/10"
                          : "border-cloak-line bg-ink-900 hover:border-cloak-muted",
                      )}
                    >
                      <p className="text-sm font-medium text-cloak-fg">{t.label}</p>
                      <p className="text-xs text-cloak-muted">{t.blurb}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label mb-1.5 block">Public total budget</label>
                  <input
                    className="input"
                    type="number"
                    placeholder="1000000"
                    value={totalBudget}
                    onChange={(e) => setTotalBudget(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Token address</label>
                  <input
                    className="input mono"
                    placeholder="0x…"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Claim start</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={claimStart}
                    onChange={(e) => setClaimStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Claim end</label>
                  <input
                    className="input"
                    type="datetime-local"
                    value={claimEnd}
                    onChange={(e) => setClaimEnd(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="label mb-1.5 block">Notes / metadata</label>
                <textarea
                  className="input min-h-[72px]"
                  placeholder="Context for the public audit page…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Recipient allocations"
              subtitle="Add recipients with the form, or paste a CSV"
              icon={<FileUp className="h-4 w-4" />}
              action={
                <div className="flex items-center gap-2">
                  <div className="flex rounded-lg border border-cloak-line bg-ink-900 p-0.5">
                    <button
                      type="button"
                      onClick={() => setRecipientMode("form")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        recipientMode === "form"
                          ? "bg-gold/15 text-gold"
                          : "text-cloak-muted hover:text-cloak-fg",
                      )}
                    >
                      Form
                    </button>
                    <button
                      type="button"
                      onClick={() => setRecipientMode("csv")}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                        recipientMode === "csv"
                          ? "bg-gold/15 text-gold"
                          : "text-cloak-muted hover:text-cloak-fg",
                      )}
                    >
                      CSV
                    </button>
                  </div>
                  <button
                    className="btn-subtle"
                    onClick={() => fileRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={onFile}
                  />
                </div>
              }
            />
            <CardBody className="space-y-4">
              {recipientMode === "form" ? (
                <>
                  <RecipientBuilder
                    recipients={parseResult?.recipients ?? []}
                    onChange={setCsvText}
                  />
                  {parseResult && parseResult.errors.length > 0 ? (
                    <div className="rounded-lg border border-cloak-danger/30 bg-cloak-danger/10 p-3">
                      <p className="text-xs font-medium text-cloak-danger">
                        {parseResult.errors.length} row(s) from CSV could not be
                        parsed. Switch to CSV mode to fix them.
                      </p>
                    </div>
                  ) : null}
                  {parseResult && budgetNum > 0 ? (
                    <BudgetChecksum
                      totalAllocation={parseResult.totalAllocation}
                      budget={budgetNum}
                      recipientCount={parseResult.recipients.length}
                    />
                  ) : null}
                  {parseResult ? (
                    <SignatureSavings
                      recipientCount={parseResult.recipients.length}
                    />
                  ) : null}
                </>

              ) : (
                <>
                  <CsvEditor
                    value={csvText}
                    onChange={setCsvText}
                    validCount={parseResult?.recipients.length ?? 0}
                    errorCount={parseResult?.errors.length ?? 0}
                  />
                  {parseResult ? (
                    <RecipientsPreview result={parseResult} budget={budgetNum} />
                  ) : (
                    <EmptyState
                      icon={<EyeOff className="h-6 w-6" />}
                      title="No recipients yet"
                      description="Paste a CSV or click Load sample CSV to preview parsed allocations."
                    />
                  )}
                </>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Confidential creation flow"
              subtitle="Encrypt → submit → TokenOps sync"
            />
            <CardBody className="space-y-5">
              <div className="space-y-3">
                <div className="rounded-lg border border-gold/20 bg-gold/5 p-3 text-xs text-cloak-muted">
                  <Lock className="mr-1.5 inline h-3 w-3 text-gold" />
                  Allocations, tiers, and vesting are encrypted client-side with
                  Zama before submission. TokenOps vesting receives encrypted
                  amounts via `@tokenops/sdk` — plaintext amounts stay off the
                  public dashboard.
                </div>
                <div className="rounded-lg border border-cloak-line bg-ink-900/60 p-3 text-xs text-cloak-muted">
                  <p className="font-medium text-cloak-fg">Two settlement rails</p>
                  <ul className="mt-2 space-y-1.5">
                    <li>
                      <span className="text-gold">Claim rail</span> — recipient
                      calls `claim()` → encrypted balance credited via `FHE.add`
                      on `CloakConfidentialToken`.
                    </li>
                    <li>
                      <span className="text-gold">TokenOps rail</span> — this
                      flow deploys + funds per-recipient vesting wallets on the
                      official confidential factory (same allocation, schedule-based
                      release).
                    </li>
                  </ul>
                </div>
              </div>

              <StepIndicator steps={STEPS} statuses={statuses} />

              {Object.entries(stepDetails).map(([key, detail]) =>
                statuses[key] === "error" ? (
                  <p key={key} className="text-xs text-cloak-danger">
                    {detail}
                  </p>
                ) : null,
              )}

              {formError ? <ErrorNotice error={formError} context="tx" /> : null}

              {created ? (
                <div className="space-y-3 rounded-lg border border-cloak-ok/30 bg-cloak-ok/10 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge tone="ok" dot>
                      Campaign #{created.onChainId} live
                    </Badge>
                    <Link
                      href={`/campaign/${created.id}`}
                      className="btn-subtle text-gold"
                    >
                      View campaign <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/public-audit/${created.id}`}
                      className="btn-subtle"
                    >
                      Public audit
                    </Link>
                    <CopyLink value="/claim" label="Copy claim link" />
                  </div>
                  <p className="text-[11px] leading-relaxed text-cloak-muted">
                    Share the claim link with recipients — they connect the wallet
                    you allocated to and decrypt their own values. The link is
                    identical for everyone; eligibility is enforced on-chain.
                  </p>
                </div>
              ) : (
                <button
                  className="btn-primary w-full"
                  onClick={handleCreate}
                  disabled={creating || !!overBudget}
                >
                  {creating ? "Running confidential flow…" : "Create confidential campaign"}
                </button>
              )}
            </CardBody>
          </Card>
        </div>

        {/* Right: TokenOps + Zama status */}
        <div className="space-y-6">
          <TokenOpsPanel />
          <Card>
            <CardHeader title="Zama encryption" subtitle="Confidential allocation layer" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-cloak-muted">Mode</span>
                <Badge tone="gold">Relayer SDK</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cloak-muted">Contract</span>
                <span className="mono text-xs text-cloak-fg">
                  {CLOAKOPS_CONTRACT_ADDRESS
                    ? shortAddress(CLOAKOPS_CONTRACT_ADDRESS, 4)
                    : "not set"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-cloak-muted">Status</span>
                <Badge tone={zamaStatus?.ready ? "ok" : "neutral"} dot>
                  {zamaStatus?.ready ? "Ready" : "Loading"}
                </Badge>
              </div>
              <p className="text-xs text-cloak-faint">{zamaStatus?.message}</p>
              {address ? (
                <p className="mono text-xs text-cloak-muted">
                  Admin: {shortAddress(address)}
                </p>
              ) : (
                <p className="text-xs text-cloak-warn">
                  Connect a wallet to record the admin address.
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RecipientsPreview({
  result,
  budget,
}: {
  result: CsvParseResult;
  budget: number;
}) {
  return (
    <div className="space-y-3">
      {result.errors.length > 0 ? (
        <div className="rounded-lg border border-cloak-danger/30 bg-cloak-danger/10 p-3">
          <p className="text-xs font-medium text-cloak-danger">
            {result.errors.length} validation error(s)
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-cloak-danger/90">
            {result.errors.slice(0, 5).map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {budget > 0 ? (
        <BudgetChecksum
          totalAllocation={result.totalAllocation}
          budget={budget}
          recipientCount={result.recipients.length}
        />
      ) : (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="chip">{result.recipients.length} recipients</span>
          <span className="chip">
            Σ allocations: {formatNumber(result.totalAllocation)}
          </span>
        </div>
      )}

      <SignatureSavings recipientCount={result.recipients.length} />


      {result.recipients.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-cloak-line">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead className="bg-ink-800 text-cloak-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Wallet</th>
                <th className="px-3 py-2 font-medium">Allocation</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Vesting</th>
                <th className="px-3 py-2 font-medium">Role</th>
              </tr>
            </thead>
            <tbody>
              {result.recipients.map((r) => (
                <tr key={r.wallet} className="border-t border-cloak-line/60">
                  <td className="mono px-3 py-2 text-cloak-fg">
                    {shortAddress(r.wallet, 6)}
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1 text-gold">
                      <Lock className="h-3 w-3" />
                      {formatNumber(r.allocation)}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gold">
                    <Lock className="mr-1 inline h-3 w-3" />
                    {r.tier}
                  </td>
                  <td className="px-3 py-2 text-gold">
                    <Lock className="mr-1 inline h-3 w-3" />
                    {r.vestingClass}
                  </td>
                  <td className="px-3 py-2 text-cloak-muted">{r.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-cloak-line bg-ink-900 px-3 py-2 text-[11px] text-cloak-faint">
            Gold lock = encrypted on submission. Only the recipient can decrypt
            their own values.
          </p>
        </div>
      ) : null}
    </div>
  );
}
