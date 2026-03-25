"use client";

import { useState } from "react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils";
import { spacing, radius } from "../../tokens";
import { useTheme, useResolvedTheme } from "../../themes";

type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const NEUTRAL_PRIMARY = "#e5e5e5";
const NEUTRAL_PRIMARY_HOVER = "#d4d4d4";

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: { padding: `${spacing[2]} ${spacing[4]}`, fontSize: "0.8125rem" },
  md: { padding: `${spacing[3]} ${spacing[6]}`, fontSize: "0.9375rem" },
  lg: { padding: `${spacing[4]} ${spacing[8]}`, fontSize: "1rem" },
};

function isLightBg(hex: string): boolean {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  className,
  style,
  children,
  onMouseEnter,
  onMouseLeave,
  type = "button",
  ...props
}: ButtonProps) {
  const themeBrand = useTheme();
  const theme = useResolvedTheme();
  const [hovered, setHovered] = useState(false);

  const isPrimary = variant === "primary";
  const brandColor = themeBrand?.primary ?? NEUTRAL_PRIMARY;
  const brandHover = themeBrand?.primaryHover ?? NEUTRAL_PRIMARY_HOVER;
  const primaryBg = isPrimary ? (hovered && !disabled ? brandHover : brandColor) : undefined;

  const primaryTextColor = isLightBg(brandColor) ? "#050505" : "#fafafa";

  const baseVariantStyles: React.CSSProperties = isPrimary
    ? {
        background: primaryBg ?? NEUTRAL_PRIMARY,
        color: primaryTextColor,
        border: "none",
      }
    : variant === "secondary"
      ? {
          background: theme.surface.base,
          color: theme.text.primary,
          border: `1px solid ${theme.border.default}`,
        }
      : variant === "ghost"
        ? {
            background: "transparent",
            color: theme.text.primary,
            border: "none",
          }
        : variant === "outline"
          ? {
              background: "transparent",
              color: theme.text.primary,
              border: `1px solid ${theme.border.default}`,
            }
          : {
              background: "rgba(239, 68, 68, 0.25)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.5)",
            };

  return (
    <button
      type={type}
      disabled={disabled}
      className={cn(className)}
      style={{
        borderRadius: radius.button,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s ease, border-color 0.15s ease",
        ...baseVariantStyles,
        ...sizeStyles[size],
        ...style,
      }}
      onMouseEnter={(e) => {
        setHovered(true);
        onMouseEnter?.(e);
      }}
      onMouseLeave={(e) => {
        setHovered(false);
        onMouseLeave?.(e);
      }}
      {...props}
    >
      {children}
    </button>
  );
}
