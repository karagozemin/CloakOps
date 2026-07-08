"use client";

import { useState } from "react";
import { Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Copy-to-clipboard button for shareable links.
 *
 * The value can be a relative path (e.g. "/claim") — we resolve it against the
 * current origin at click time so the copied URL works when pasted anywhere.
 */
export function CopyLink({
  value,
  label = "Copy claim link",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      const url =
        value.startsWith("http") || typeof window === "undefined"
          ? value
          : `${window.location.origin}${value}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked (e.g. insecure context) — fail quietly.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn("btn-subtle", copied && "text-cloak-ok", className)}
      title="Copy a shareable link recipients can open to claim"
    >
      {copied ? (
        <>
          <Check className="h-3.5 w-3.5" /> Copied
        </>
      ) : (
        <>
          <Link2 className="h-3.5 w-3.5" /> {label}
        </>
      )}
    </button>
  );
}
