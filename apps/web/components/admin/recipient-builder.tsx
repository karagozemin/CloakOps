"use client";

import { useState } from "react";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import type { ParsedRecipient } from "@/lib/csv/parse";
import { TIER_LABELS, VESTING_LABELS } from "@/lib/sample/data";
import { cn, formatNumber, shortAddress } from "@/lib/utils";
import { Lock, Plus, Trash2, UserPlus, Wallet } from "lucide-react";

const ROLE_OPTIONS = [
  "contributor",
  "core-contributor",
  "advisor",
  "angel-investor",
  "strategic-investor",
];

function serialize(rows: ParsedRecipient[]): string {
  const header = "wallet,allocation,tier,vestingClass,role";
  const lines = rows.map(
    (r) => `${r.wallet},${r.allocation},${r.tier},${r.vestingClass},${r.role}`,
  );
  return [header, ...lines].join("\n");
}

export function RecipientBuilder({
  recipients,
  onChange,
}: {
  recipients: ParsedRecipient[];
  onChange: (csv: string) => void;
}) {
  const { address } = useAccount();
  const [wallet, setWallet] = useState("");
  const [allocation, setAllocation] = useState("");
  const [tier, setTier] = useState(2);
  const [vestingClass, setVestingClass] = useState(1);
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [error, setError] = useState<string | null>(null);

  const duplicate =
    wallet.trim() !== "" &&
    recipients.some((r) => r.wallet.toLowerCase() === wallet.trim().toLowerCase());

  function addRecipient() {
    const w = wallet.trim();
    if (!isAddress(w)) {
      setError("Enter a valid 0x wallet address.");
      return;
    }
    if (duplicate) {
      setError("This wallet is already in the list.");
      return;
    }
    const alloc = Number(allocation);
    if (!Number.isInteger(alloc) || alloc <= 0) {
      setError("Allocation must be a positive whole number.");
      return;
    }
    setError(null);
    const next: ParsedRecipient[] = [
      ...recipients,
      { wallet: w, allocation: alloc, tier, vestingClass, role },
    ];
    onChange(serialize(next));
    setWallet("");
    setAllocation("");
  }

  function removeRecipient(target: string) {
    const next = recipients.filter(
      (r) => r.wallet.toLowerCase() !== target.toLowerCase(),
    );
    onChange(next.length ? serialize(next) : "");
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addRecipient();
    }
  }

  return (
    <div className="space-y-4">
      {/* Add-recipient form */}
      <div className="rounded-xl border border-cloak-line bg-ink-900 p-4">
        <div className="space-y-3">
          <div>
            <label className="label mb-1.5 block">Wallet address</label>
            <div className="flex gap-2">
              <input
                className="input mono flex-1"
                placeholder="0x…"
                value={wallet}
                onChange={(e) => setWallet(e.target.value)}
                onKeyDown={onKeyDown}
              />
              {address ? (
                <button
                  type="button"
                  className="btn-subtle shrink-0"
                  onClick={() => setWallet(address)}
                  title="Use my connected wallet"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  Me
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label mb-1.5 block">
                <Lock className="mr-1 inline h-3 w-3 text-gold" />
                Allocation
              </label>
              <input
                className="input"
                type="number"
                min={1}
                placeholder="25000"
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                onKeyDown={onKeyDown}
              />
            </div>
            <div>
              <label className="label mb-1.5 block">Role</label>
              <select
                className="input"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">
                <Lock className="mr-1 inline h-3 w-3 text-gold" />
                Tier
              </label>
              <select
                className="input"
                value={tier}
                onChange={(e) => setTier(Number(e.target.value))}
              >
                {Object.entries(TIER_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label mb-1.5 block">
                <Lock className="mr-1 inline h-3 w-3 text-gold" />
                Vesting class
              </label>
              <select
                className="input"
                value={vestingClass}
                onChange={(e) => setVestingClass(Number(e.target.value))}
              >
                {Object.entries(VESTING_LABELS).map(([val, lbl]) => (
                  <option key={val} value={val}>
                    {lbl}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? (
            <p className="text-xs text-cloak-danger">{error}</p>
          ) : null}

          <button
            type="button"
            className="btn-primary w-full"
            onClick={addRecipient}
            disabled={!wallet.trim() || !allocation.trim() || duplicate}
          >
            <Plus className="h-4 w-4" />
            Add recipient
          </button>
        </div>
      </div>

      {/* Current recipients list */}
      {recipients.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-cloak-line">
          <div className="flex items-center justify-between border-b border-cloak-line bg-ink-850/80 px-3 py-2 text-xs text-cloak-muted">
            <span className="inline-flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-gold" />
              {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
            </span>
            <span className="inline-flex items-center gap-1 text-gold">
              <Lock className="h-3 w-3" />
              encrypted on submission
            </span>
          </div>
          <ul className="divide-y divide-cloak-line/60">
            {recipients.map((r) => (
              <li
                key={r.wallet}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-xs"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="mono text-cloak-fg">
                    {shortAddress(r.wallet, 6)}
                  </span>
                  <span className="inline-flex items-center gap-1 text-gold">
                    <Lock className="h-3 w-3" />
                    {formatNumber(r.allocation)}
                  </span>
                  <span className="hidden text-cloak-muted sm:inline">
                    {TIER_LABELS[r.tier] ?? `Tier ${r.tier}`}
                  </span>
                  <span className="chip hidden sm:inline-flex">{r.role}</span>
                </div>
                <button
                  type="button"
                  className="rounded-md p-1.5 text-cloak-muted transition-colors hover:bg-cloak-danger/10 hover:text-cloak-danger"
                  onClick={() => removeRecipient(r.wallet)}
                  title="Remove recipient"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-cloak-line px-3 py-6 text-center text-xs text-cloak-faint">
          No recipients yet. Fill the fields above and click{" "}
          <span className={cn("text-gold")}>Add recipient</span>.
        </p>
      )}
    </div>
  );
}
