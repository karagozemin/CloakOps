"use client";

import { useEffect, useRef, useState } from "react";
import { Lock, LockOpen, Loader2, TriangleAlert } from "lucide-react";
import { cn, shortAddress } from "@/lib/utils";

const SCRAMBLE_GLYPHS = "0123456789•#*$%";

/**
 * RevealValue — the "delight" moment. When an encrypted field is decrypted,
 * the ciphertext masking (`•••••`) resolves into the real value with a
 * left-to-right scramble that locks each character into place. This makes the
 * act of decryption feel tangible instead of the value just snapping in.
 */
function RevealValue({ text }: { text: string }) {
  const [display, setDisplay] = useState(() =>
    text.replace(/[^\s]/g, "•"),
  );
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const chars = text.split("");
    const totalFrames = Math.max(14, chars.length * 2);
    let frame = 0;

    function tick() {
      // Each character "locks in" progressively from left to right.
      const lockedCount = Math.floor((frame / totalFrames) * chars.length);
      const next = chars
        .map((ch, i) => {
          if (ch === " " || ch === "," || ch === ".") return ch;
          if (i < lockedCount) return ch;
          return SCRAMBLE_GLYPHS[
            Math.floor(Math.random() * SCRAMBLE_GLYPHS.length)
          ];
        })
        .join("");
      setDisplay(next);

      frame += 1;
      if (frame <= totalFrames) {
        frameRef.current = window.setTimeout(
          () => requestAnimationFrame(tick),
          32,
        );
      } else {
        setDisplay(text);
      }
    }

    frameRef.current = window.setTimeout(
      () => requestAnimationFrame(tick),
      0,
    );

    return () => {
      if (frameRef.current) window.clearTimeout(frameRef.current);
    };
  }, [text]);

  return (
    <span className="mono tabular-nums transition-colors">{display}</span>
  );
}


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
        <p className="mt-2 text-xl font-semibold tracking-tight text-cloak-ok">
          <RevealValue text={format ? format(value) : value.toString()} />
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
