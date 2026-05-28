import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LOGO_SRC = "/brand/cloakops-logo.png";

type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeMap: Record<LogoSize, { height: number; width: number; className: string }> = {
  xs: { height: 28, width: 28, className: "h-7 w-7" },
  sm: { height: 36, width: 36, className: "h-9 w-9" },
  md: { height: 44, width: 44, className: "h-11 w-11" },
  lg: { height: 72, width: 72, className: "h-[4.5rem] w-[4.5rem]" },
  xl: { height: 112, width: 112, className: "h-28 w-28" },
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
