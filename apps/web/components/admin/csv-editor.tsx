"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { FileSpreadsheet, Lock, Rows3 } from "lucide-react";

const COLUMNS = [
  { key: "wallet", label: "wallet", hint: "0x address", encrypted: false },
  { key: "allocation", label: "allocation", hint: "uint", encrypted: true },
  { key: "tier", label: "tier", hint: "0–255", encrypted: true },
  { key: "vestingClass", label: "vestingClass", hint: "0–255", encrypted: true },
  { key: "role", label: "role", hint: "label", encrypted: false },
];

const PLACEHOLDER =
  "wallet,allocation,tier,vestingClass,role\n0x…,25000,2,1,contributor";

export function CsvEditor({
  value,
  onChange,
  validCount = 0,
  errorCount = 0,
}: {
  value: string;
  onChange: (next: string) => void;
  validCount?: number;
  errorCount?: number;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  const lineCount = useMemo(() => {
    if (!value) return 1;
    return value.split("\n").length;
  }, [value]);

  function syncScroll() {
    if (gutterRef.current && taRef.current) {
      gutterRef.current.scrollTop = taRef.current.scrollTop;
    }
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-ink-900 transition-colors",
        focused ? "border-gold/50 shadow-glow" : "border-cloak-line",
      )}
    >
      {/* Column header bar */}
      <div className="flex items-center gap-2 border-b border-cloak-line bg-ink-850/80 px-3 py-2">
        <FileSpreadsheet className="h-3.5 w-3.5 shrink-0 text-gold" />
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {COLUMNS.map((c) => (
            <span
              key={c.key}
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium",
                c.encrypted
                  ? "border-gold/30 bg-gold/10 text-gold"
                  : "border-cloak-line bg-ink-800 text-cloak-muted",
              )}
              title={
                c.encrypted
                  ? `${c.hint} · encrypted with Zama FHE`
                  : `${c.hint} · public`
              }
            >
              {c.encrypted ? <Lock className="h-2.5 w-2.5" /> : null}
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Editor body: line numbers + textarea */}
      <div className="relative flex max-h-[260px]">
        <div
          ref={gutterRef}
          aria-hidden
          className="mono select-none overflow-hidden border-r border-cloak-line/60 bg-ink-850/40 py-3 text-right text-xs leading-5 text-cloak-faint"
          style={{ minWidth: "2.75rem" }}
        >
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="px-2">
              {i + 1}
            </div>
          ))}
        </div>

        <textarea
          ref={taRef}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="mono min-h-[160px] flex-1 resize-y bg-transparent px-3 py-3 text-xs leading-5 text-cloak-fg outline-none placeholder:text-cloak-faint/60"
          placeholder={PLACEHOLDER}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </div>

      {/* Footer status bar */}
      <div className="flex items-center justify-between border-t border-cloak-line bg-ink-850/80 px-3 py-1.5 text-[11px]">
        <span className="inline-flex items-center gap-1.5 text-cloak-muted">
          <Rows3 className="h-3 w-3" />
          {Math.max(lineCount - 1, 0)} row{lineCount - 1 === 1 ? "" : "s"}
        </span>
        <span className="flex items-center gap-3">
          {validCount > 0 ? (
            <span className="text-cloak-ok">{validCount} valid</span>
          ) : null}
          {errorCount > 0 ? (
            <span className="text-cloak-danger">{errorCount} error{errorCount === 1 ? "" : "s"}</span>
          ) : null}
          <span className="inline-flex items-center gap-1 text-gold">
            <Lock className="h-2.5 w-2.5" /> encrypted client-side
          </span>
        </span>
      </div>
    </div>
  );
}
