import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/cloakops-logo.png";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const sizeMap: Record<LogoSize, { height: number; width: number; className: string }> = {
  xs: { height: 28, width: 28, className: "h-7 w-7" },
  sm: { height: 36, width: 36, className: "h-9 w-9" },
  md: { height: 48, width: 48, className: "h-12 w-12" },
  lg: { height: 64, width: 64, className: "h-16 w-16" },
  xl: { height: 144, width: 144, className: "h-36 w-36" },
  "2xl": {
    height: 192,
    width: 192,
    className: "h-48 w-48 sm:h-56 sm:w-56",
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
