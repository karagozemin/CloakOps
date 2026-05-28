"use client";

import { useState } from "react";
import { Lock, LockOpen, Loader2, TriangleAlert } from "lucide-react";
import { cn, shortAddress } from "@/lib/utils";

export function EncryptedField({
  label,
  handle,
  onDecrypt,
  format,
  canDecrypt,
  disabledReason,
}: {
  label: string;
  handle: string;
  onDecrypt: () => Promise<bigint>;
  format?: (value: bigint) => string;
  canDecrypt: boolean;
  disabledReason?: string;
}) {
  const [state, setState] = useState<"locked" | "loading" | "open" | "error">(
    "locked",
  );
  const [value, setValue] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDecrypt() {
    setState("loading");
    setError(null);
    try {
      const v = await onDecrypt();
      setValue(v);
      setState("open");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Decryption failed.");
      setState("error");
    }
  }

  return (
    <div className="rounded-lg border border-cloak-line bg-ink-900/50 p-4">
      <div className="flex items-center justify-between">
        <p className="label">{label}</p>
        {state === "open" ? (
          <LockOpen className="h-3.5 w-3.5 text-cloak-ok" />
        ) : (
          <Lock className="h-3.5 w-3.5 text-gold" />
        )}
      </div>

      {state === "open" && value !== null ? (
        <p className="mt-2 text-xl font-semibold tracking-tight text-cloak-fg">
          {format ? format(value) : value.toString()}
        </p>
      ) : (
        <p
          className="mono mt-2 truncate text-sm text-cloak-faint"
          title={handle}
        >
          {shortAddress(handle, 8)}
        </p>
      )}

      <div className="mt-3">
        {state === "open" ? (
          <span className="chip border-cloak-ok/30 bg-cloak-ok/10 text-cloak-ok">
            Decrypted for you
          </span>
        ) : (
          <button
            className={cn(
              "btn-ghost w-full",
              !canDecrypt && "cursor-not-allowed opacity-50",
            )}
            onClick={handleDecrypt}
            disabled={!canDecrypt || state === "loading"}
            title={!canDecrypt ? disabledReason : undefined}
          >
            {state === "loading" ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Decrypting…
              </>
            ) : (
              <>
                <LockOpen className="h-3.5 w-3.5" />
                Decrypt
              </>
            )}
          </button>
        )}
      </div>

      {state === "error" && error ? (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-cloak-danger">
          <TriangleAlert className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </div>
  );
}
