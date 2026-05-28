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
  icons: {
    icon: "/brand/cloakops-logo.png",
    apple: "/brand/cloakops-logo.png",
  },
  openGraph: {
    title: "CloakOps — Confidential campaign layer for TokenOps",
    description:
      "Private allocations. Public rules. TokenOps execution. Built on Zama FHE.",
    images: [{ url: "/brand/cloakops-logo.png", width: 512, height: 512, alt: "CloakOps" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "CloakOps",
    description: "Private allocations. Public rules. TokenOps execution.",
    images: ["/brand/cloakops-logo.png"],
  },
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
