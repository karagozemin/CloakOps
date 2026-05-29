"use client";

import { usePathname } from "next/navigation";
import { AppPageBackground } from "@/components/landing/landing-backgrounds";

const APP_PREFIXES = ["/admin", "/claim", "/public-audit"];

export function AppBackground() {
  const pathname = usePathname();
  const show = APP_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!show) return null;

  return <AppPageBackground />;
}
