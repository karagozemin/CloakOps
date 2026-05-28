import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/cloakops-logo.png?v=2";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const sizeMap: Record<LogoSize, { height: number; width: number; className: string }> = {
  xs: { height: 28, width: 28, className: "h-7 w-7" },
  sm: { height: 36, width: 36, className: "h-9 w-9" },
  md: { height: 48, width: 48, className: "h-12 w-12" },
  lg: { height: 56, width: 56, className: "h-14 w-14" },
  xl: { height: 144, width: 144, className: "h-36 w-36" },
  "2xl": {
    height: 176,
    width: 176,
    className: "h-44 w-44 sm:h-48 sm:w-48",
  },
};

export function Logo({
  size = "sm",
  className,
  priority = false,
}: {
  size?: LogoSize;
  className?: string;
  priority?: boolean;
}) {
  const dims = sizeMap[size];
  return (
    <Image
      src={LOGO_SRC}
      alt="CloakOps"
      width={dims.width}
      height={dims.height}
      priority={priority}
      unoptimized
      className={cn("object-contain", dims.className, className)}
    />
  );
}

export function LogoLink({
  size = "sm",
  className,
  priority = false,
}: {
  size?: LogoSize;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("inline-flex shrink-0 items-center transition-opacity hover:opacity-90", className)}
      aria-label="CloakOps home"
    >
      <Logo size={size} priority={priority} />
    </Link>
  );
}
