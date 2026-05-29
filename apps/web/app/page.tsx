import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  LandingPageBackground,
} from "@/components/landing/landing-backgrounds";
import {
  ArrowRight,
  Eye,
  EyeOff,
  FileLock2,
  Layers,
  LineChart,
  Lock,
  ShieldCheck,
  Workflow,
} from "lucide-react";

export default function LandingPage() {
  return (
    <>
      <LandingPageBackground />

      <div className="relative z-10">
        {/* Hero */}
        <section className="relative w-full py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <div className="mb-6 flex justify-center">
              <Logo size="2xl" priority className="drop-shadow-glow" />
            </div>
            <Badge tone="gold" className="mb-6">
              <ShieldCheck className="h-3.5 w-3.5" />
              Zama FHE · TokenOps
            </Badge>
            <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight sm:text-6xl">
              Private allocations.
              <br />
              Public rules.
              <br />
              <span className="text-gold">TokenOps execution.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-base leading-relaxed text-cloak-muted sm:text-lg">
              CloakOps is a confidential campaign layer for TokenOps. Run private
              rounds, contributor rewards, advisor vesting, and community
              distributions where allocation amounts, tiers, and vesting metadata
              stay encrypted with Zama FHE — while budgets, rules, and claim status
              remain publicly verifiable.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/admin" className="btn-primary">
                Launch Admin
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/claim" className="btn-ghost">
                Open Claim
              </Link>
              <Link href="/admin" className="btn-subtle">
                Create campaign
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          {/* Privacy split */}
          <section className="grid gap-4 pb-16 md:grid-cols-2">
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center gap-2">
                  <Eye className="h-4 w-4 text-cloak-info" />
                  <h3 className="text-sm font-semibold">Public &amp; verifiable</h3>
                </div>
                <ul className="space-y-2 text-sm text-cloak-muted">
                  {[
                    "Total campaign budget",
                    "Campaign type & rules",
                    "Claim window (start / end)",
                    "Number of recipients",
                    "Claimed count",
                    "Contract address",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="h-1 w-1 rounded-full bg-cloak-info" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <div className="mb-3 flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-gold" />
                  <h3 className="text-sm font-semibold">Encrypted with Zama FHE</h3>
                </div>
                <ul className="space-y-2 text-sm text-cloak-muted">
                  {[
                    "Per-recipient allocation amount",
                    "Recipient tier",
                    "Vesting class / schedule metadata",
                    "Decryptable only by the recipient",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <Lock className="h-3 w-3 text-gold" />
                      {item}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-xs text-cloak-faint">
                  Honest limitation: recipient wallet addresses and transaction
                  timing remain visible on-chain in this MVP.
                </p>
              </CardBody>
            </Card>
          </section>

          {/* Problem / Solution */}
          <section className="grid gap-6 pb-16 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Public chains leak distribution strategy
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-cloak-muted">
                Investors, advisors, contributors, and team members can infer each
                other&apos;s deals from public token transfers and vesting contracts.
                Anyone can see who got the biggest allocation, which contributors are
                top-tier, what advisors received, and when each party claimed.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-cloak-muted">
                Normal encryption does not help: you cannot run claim logic or prove
                campaign totals over data nobody can compute on. Fully Homomorphic
                Encryption lets the contract operate on encrypted allocations
                directly — so the rules stay public while the numbers stay private.
              </p>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                CloakOps + TokenOps + Zama
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-cloak-muted">
                TokenOps provides the campaign and distribution lifecycle rails.
                CloakOps adds the confidential allocation, tier, and vesting metadata
                layer with Zama FHE. The result is a confidential campaign operations
                layer for private rounds, contributor rewards, advisor vesting, and
                community distributions.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge tone="gold">Private Round</Badge>
                <Badge tone="gold">Contributor Rewards</Badge>
                <Badge tone="gold">Advisor Vesting</Badge>
                <Badge tone="gold">Community Distribution</Badge>
              </div>
            </div>
          </section>

          {/* Feature grid */}
          <section className="grid gap-4 pb-16 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileLock2,
                title: "Encrypted CSV upload",
                body: "Upload allocations; amounts, tiers, and vesting are encrypted client-side before they hit the chain.",
              },
              {
                icon: Workflow,
                title: "TokenOps lifecycle",
                body: "Create campaign, sync recipients, and prepare the confidential distribution operation — visible in the UI.",
              },
              {
                icon: Layers,
                title: "FHE on-chain",
                body: "ConfidentialCampaign.sol stores euint64 / euint8 values with per-recipient FHE access control.",
              },
              {
                icon: LineChart,
                title: "Public audit",
                body: "Anyone can verify totals, rules, and claim progress without ever seeing a private deal.",
              },
            ].map((f) => (
              <Card key={f.title}>
                <CardBody>
                  <f.icon className="mb-3 h-5 w-5 text-gold" />
                  <h3 className="text-sm font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-cloak-muted">
                    {f.body}
                  </p>
                </CardBody>
              </Card>
            ))}
          </section>

          {/* Track fit */}
          <section className="pb-24">
            <Card>
              <CardBody className="sm:p-8">
                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <Badge tone="info" className="mb-3">
                      Builder Track
                    </Badge>
                    <p className="text-sm leading-relaxed text-cloak-muted">
                      A real-world confidential dApp: token distribution leaks are a
                      genuine financial privacy problem, and CloakOps shows how FHE
                      keeps sensitive allocation data private while campaign rules
                      stay publicly verifiable.
                    </p>
                  </div>
                  <div>
                    <Badge tone="gold" className="mb-3">
                      TokenOps Special Bounty
                    </Badge>
                    <p className="text-sm leading-relaxed text-cloak-muted">
                      TokenOps is central, not a footnote: the admin flow creates a
                      TokenOps campaign, syncs recipients, and prepares a confidential
                      distribution operation — with live connection status and an
                      operation log surfaced in the product.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </section>
        </div>
      </div>
    </>
  );
}
