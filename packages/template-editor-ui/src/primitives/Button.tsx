"use client";

import { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { cn } from "./cn";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "whatsapp";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  accentColor?: string;
}

const SIZE_STYLES: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-10 px-4 py-2 text-sm [&:has(>svg:only-child)]:min-h-10 [&:has(>svg:only-child)]:min-w-10 [&:has(>svg:only-child)]:p-2",
  md: "min-h-11 px-5 py-2.5 text-sm [&:has(>svg:only-child)]:min-h-11 [&:has(>svg:only-child)]:min-w-11 [&:has(>svg:only-child)]:p-2.5",
  lg: "min-h-12 px-6 py-3 text-base [&:has(>svg:only-child)]:min-h-12 [&:has(>svg:only-child)]:min-w-12 [&:has(>svg:only-child)]:p-3",
};

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  accentColor,
  style,
  ...props
}: ButtonProps) {
  const defaultAccentColor = "#c27b3d";
  const whatsappColor = "#25D366";
  const effectiveAccentColor =
    variant === "whatsapp" ? whatsappColor : accentColor || defaultAccentColor;

  const baseStyles = cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-tight",
    "transition-all duration-200",
    "disabled:cursor-not-allowed disabled:opacity-50",
    "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
    SIZE_STYLES[size],
  );

  const variantStyles =
    variant === "primary"
      ? "text-white shadow-[0_4px_14px_0_rgba(0,0,0,0.1)] hover:shadow-[0_8px_25px_-5px_rgba(0,0,0,0.15)] active:scale-[0.98] focus-visible:ring-[var(--ds-btn-accent)]"
      : variant === "secondary"
        ? "border border-[#111827]/10 bg-white text-[#111827] shadow-sm hover:border-[#111827]/30 hover:text-[#111827] hover:shadow-md active:scale-[0.98] focus-visible:ring-[#111827]/20"
        : variant === "outline"
          ? "border border-[#e5e7eb] bg-transparent text-[#111827] hover:bg-[#f9fafb] active:scale-[0.98] focus-visible:ring-[#111827]/20"
          : "text-white shadow-[0_6px_18px_-8px_rgba(17,24,39,0.5)] active:scale-[0.98] focus-visible:ring-[var(--ds-btn-accent)]";

  const accentStyle =
    variant === "primary" || variant === "whatsapp"
      ? ({ backgroundColor: effectiveAccentColor, ["--ds-btn-accent" as string]: effectiveAccentColor } as CSSProperties)
      : undefined;

  return (
    <button
      className={cn(baseStyles, variantStyles, className)}
      style={{ ...accentStyle, ...style }}
      onMouseEnter={(e) => {
        if (variant === "primary" || variant === "whatsapp") {
          e.currentTarget.style.backgroundColor = variant === "whatsapp" ? "#1ebe5d" : `${effectiveAccentColor}e6`;
        }
      }}
      onMouseLeave={(e) => {
        if (variant === "primary" || variant === "whatsapp") {
          e.currentTarget.style.backgroundColor = effectiveAccentColor;
        }
      }}
      {...props}
    >
      {children}
    </button>
  );
}
