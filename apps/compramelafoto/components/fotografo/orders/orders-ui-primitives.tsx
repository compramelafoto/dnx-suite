"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function IconDownload({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3v12m0 0l4-4m-4 4l-4-4M5 21h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconCopy({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
      <path d="M5 15V5a2 2 0 012-2h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconEye({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C6.48 2 2 6.03 2 10.78c0 2.41 1.19 4.57 3.05 6.05L4 22l5.35-1.4c.89.24 1.83.37 2.65.37 5.52 0 10-4.03 10-8.78S17.52 2 12 2zm0 14.5c-.72 0-1.42-.1-2.08-.29l-.15-.04-2.2.58.59-2.14-.1-.15A5.9 5.9 0 017 10.78C7 7.57 9.24 5 12 5s5 2.57 5 5.78-2.24 5.72-5 5.72z" />
    </svg>
  );
}

export function IconClear({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={cn("shrink-0", className)} width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type OrdersIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "default" | "primary" | "success" | "whatsapp" | "copied";
  size?: "sm" | "md";
  children: ReactNode;
};

const ICON_VARIANTS = {
  default: "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:border-gray-300",
  primary: "border-[#c27b3d] bg-[#c27b3d] text-white hover:bg-[#b06a2f]",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  whatsapp: "border-[#128C7E]/30 bg-[#25D366] text-white hover:bg-[#1fb855]",
  copied: "border-indigo-200 bg-indigo-50 text-indigo-700",
};

const ICON_SIZES = {
  sm: "h-8 w-8",
  md: "h-9 w-9",
};

export function OrdersIconButton({
  label,
  variant = "default",
  size = "sm",
  className,
  children,
  ...props
}: OrdersIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg border transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        ICON_SIZES[size],
        ICON_VARIANTS[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type OrdersPrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  loading?: boolean;
  loadingLabel?: string;
};

export function OrdersPrimaryButton({
  icon,
  loading,
  loadingLabel = "…",
  children,
  className,
  disabled,
  ...props
}: OrdersPrimaryButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#c27b3d] px-3 py-2",
        "text-xs font-semibold text-white whitespace-nowrap",
        "hover:bg-[#b06a2f] transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    >
      {icon}
      {loading ? loadingLabel : children}
    </button>
  );
}

/** Grid desktop: Pedido | Cliente | Estado | Detalle | Monto | Acciones */
export const DESKTOP_ORDERS_GRID =
  "grid-cols-[120px_minmax(240px,1.3fr)_minmax(210px,1fr)_minmax(180px,0.9fr)_130px_150px]";

export const DESKTOP_ROW_CLASS = cn("grid gap-x-4 items-start", DESKTOP_ORDERS_GRID);
