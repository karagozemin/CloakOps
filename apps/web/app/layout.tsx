import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "CloakOps — Confidential campaign layer for TokenOps",
  description:
    "Run private token rounds, contributor rewards, advisor vesting, and community distributions where allocations, tiers, and vesting stay encrypted with Zama FHE, while campaign rules and totals remain publicly verifiable.",
  keywords: [
    "Zama",
    "FHE",
    "FHEVM",
    "TokenOps",
    "confidential",
    "token distribution",
    "airdrop",
    "vesting",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <SiteHeader />
            <main className="flex-1">{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
