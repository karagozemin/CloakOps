"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "./connect-button";
import { TokenOpsStatusPill } from "./tokenops/status-pill";
import { cn } from "@/lib/utils";
import { Shield } from "lucide-react";

const NAV = [
  { href: "/admin", label: "Admin" },
  { href: "/claim", label: "Claim" },
  { href: "/public-audit/1", label: "Public Audit" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-cloak-line bg-ink-950/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-gold/30 bg-gold/10">
              <Shield className="h-4 w-4 text-gold" />
            </span>
            <span className="text-base font-semibold tracking-tight">
              Cloak<span className="text-gold">Ops</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => {
              const active = pathname.startsWith(item.href.split("/").slice(0, 2).join("/"));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm transition-colors",
                    active
                      ? "bg-ink-800 text-cloak-fg"
                      : "text-cloak-muted hover:text-cloak-fg",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <TokenOpsStatusPill />
          </div>
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}
