import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-cloak-line">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-sm font-semibold">
              Cloak<span className="text-gold">Ops</span>
            </p>
            <p className="mt-1 text-xs text-cloak-muted">
              Private allocations. Public rules. TokenOps execution.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-cloak-muted">
            <span>Built for Zama Builder Track</span>
            <span className="text-cloak-faint">·</span>
            <span>TokenOps Special Bounty</span>
            <span className="text-cloak-faint">·</span>
            <Link href="/public-audit/1" className="hover:text-gold">
              Public Audit
            </Link>
          </div>
        </div>
        <p className="mt-6 text-[11px] leading-relaxed text-cloak-faint">
          CloakOps encrypts allocation amounts, tiers, and vesting metadata with
          Zama FHE. Campaign totals, rules, and claim status stay publicly
          verifiable. Recipient wallet addresses, transaction timing, and the
          admin address are not hidden in this MVP.
        </p>
      </div>
    </footer>
  );
}
