"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type OrdersQuickActionChipProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  label: string;
  variant?: "default" | "primary" | "whatsapp" | "success" | "muted";
  asChild?: false;
};

const VARIANTS = {
  default:
    "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-800",
  primary:
    "border-[#c27b3d]/25 bg-[#c27b3d]/5 text-[#9a5f2e] hover:border-[#c27b3d]/40 hover:bg-[#c27b3d]/10",
  whatsapp:
    "border-[#128C7E]/20 bg-[#25D366]/8 text-[#128C7E] hover:bg-[#25D366]/12",
  success:
    "border-emerald-100 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100/70",
  muted: "border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-600",
};

export default function OrdersQuickActionChip({
  icon,
  label,
  variant = "default",
  className,
  disabled,
  ...props
}: OrdersQuickActionChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-[10px] font-medium leading-none whitespace-nowrap transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-45",
        VARIANTS[variant],
        className
      )}
      {...props}
    >
      {icon ? <span className="inline-flex shrink-0 [&_svg]:h-3 [&_svg]:w-3">{icon}</span> : null}
      {label}
    </button>
  );
}

type OrdersQuickActionLinkProps = {
  href: string;
  icon?: ReactNode;
  label: string;
  variant?: OrdersQuickActionChipProps["variant"];
  className?: string;
  target?: string;
  rel?: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
};

export function OrdersQuickActionLink({
  href,
  icon,
  label,
  variant = "default",
  className,
  target = "_blank",
  rel = "noopener noreferrer",
  onClick,
}: OrdersQuickActionLinkProps) {
  return (
    <a
      href={href}
      target={target}
      rel={rel}
      onClick={onClick}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5",
        "text-[10px] font-medium leading-none whitespace-nowrap transition-colors no-underline",
        VARIANTS[variant],
        className
      )}
    >
      {icon ? <span className="inline-flex shrink-0 [&_svg]:h-3 [&_svg]:w-3">{icon}</span> : null}
      {label}
    </a>
  );
}

export function OrdersQuickActionsRow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-1.5 min-w-0",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}
