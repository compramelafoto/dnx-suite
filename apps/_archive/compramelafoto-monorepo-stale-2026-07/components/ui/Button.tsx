"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Button as DSButton } from "@repo/design-system";
import { cn } from "@/lib/utils";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  /** Color de marca del fotógrafo/lab; si no se pasa, usa `themeComprameLaFoto.brand` vía DS. */
  accentColor?: string;
}

export default function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  accentColor,
  style,
  onMouseEnter,
  onMouseLeave,
  ...props
}: ButtonProps) {
  const accentPrimary = variant === "primary" && Boolean(accentColor);
  const mergedStyle =
    accentPrimary && accentColor
      ? { backgroundColor: accentColor, borderColor: accentColor, ...style }
      : style;

  return (
    <DSButton
      variant={variant}
      size={size}
      className={cn(className)}
      style={mergedStyle}
      onMouseEnter={(e) => {
        if (accentPrimary) {
          e.currentTarget.style.filter = "brightness(1.08)";
        }
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        if (accentPrimary) {
          e.currentTarget.style.filter = "";
        }
        onMouseLeave?.(e);
      }}
      {...props}
    >
      {children}
    </DSButton>
  );
}
