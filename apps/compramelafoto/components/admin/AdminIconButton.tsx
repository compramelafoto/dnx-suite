"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const BASE_CLASS =
  "inline-flex shrink-0 items-center justify-center w-8 h-8 rounded-lg border border-gray-300 bg-white text-gray-600 transition-colors hover:bg-gray-100 hover:border-gray-400 disabled:pointer-events-none disabled:opacity-50";

type AdminIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  variant?: "default" | "danger" | "primary";
  children: ReactNode;
};

const VARIANT_CLASS = {
  default: "",
  danger: "text-red-600 hover:bg-red-50 hover:border-red-300",
  primary: "border-[#c27b3d] bg-[#c27b3d] text-white hover:bg-[#b06a2f] hover:border-[#b06a2f]",
};

export default function AdminIconButton({
  label,
  variant = "default",
  className,
  children,
  ...props
}: AdminIconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(BASE_CLASS, VARIANT_CLASS[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}
