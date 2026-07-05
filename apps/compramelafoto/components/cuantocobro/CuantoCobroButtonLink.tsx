import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type CuantoCobroButtonLinkProps = {
  href: string;
  variant?: "primary" | "secondary" | "outline";
  className?: string;
  children: ReactNode;
};

export default function CuantoCobroButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: CuantoCobroButtonLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "cc-btn-link",
        variant === "primary" && "cc-btn-link--primary",
        variant === "secondary" && "cc-btn-link--secondary",
        variant === "outline" && "cc-btn-link--outline",
        className,
      )}
    >
      {children}
    </Link>
  );
}
