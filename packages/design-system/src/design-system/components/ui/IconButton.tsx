"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils";
import { radius } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { Icon } from "./Icon";
import { getIcon, type IconName } from "../../icons";
import type { LucideIcon } from "lucide-react";

type IconButtonVariant = "primary" | "secondary" | "success" | "warning" | "danger" | "destructive" | "neutral" | "ghost" | "outline";
type IconButtonSize = "sm" | "md" | "lg";

const sizeMap = {
  sm: 32,
  md: 40,
  lg: 48,
} as const;

const variantStyles: Record<IconButtonVariant, (theme: ReturnType<typeof useResolvedTheme>) => React.CSSProperties> = {
  primary: (theme) => ({
    background: theme.brand.primary,
    color: theme.mode === "dark" ? "#fafafa" : "#050505",
    border: "none",
  }),
  secondary: (theme) => ({
    background: theme.surface.base,
    color: theme.text.primary,
    border: `1px solid ${theme.border.default}`,
  }),
  success: () => ({
    background: "rgba(34, 197, 94, 0.2)",
    color: "#22c55e",
    border: "1px solid rgba(34, 197, 94, 0.4)",
  }),
  warning: () => ({
    background: "rgba(234, 179, 8, 0.2)",
    color: "#eab308",
    border: "1px solid rgba(234, 179, 8, 0.4)",
  }),
  danger: () => ({
    background: "rgba(239, 68, 68, 0.2)",
    color: "#f87171",
    border: "1px solid rgba(239, 68, 68, 0.4)",
  }),
  destructive: () => ({
    background: "rgba(239, 68, 68, 0.2)",
    color: "#f87171",
    border: "1px solid rgba(239, 68, 68, 0.4)",
  }),
  neutral: (theme) => ({
    background: theme.surface.base,
    color: theme.text.secondary,
    border: `1px solid ${theme.border.subtle}`,
  }),
  ghost: (theme) => ({
    background: "transparent",
    color: theme.text.primary,
    border: "none",
  }),
  outline: (theme) => ({
    background: "transparent",
    color: theme.text.primary,
    border: `1px solid ${theme.border.default}`,
  }),
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon?: LucideIcon | IconName;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  "aria-label": string;
}

export function IconButton({
  icon,
  variant = "primary",
  size = "md",
  className,
  style,
  "aria-label": ariaLabel,
  disabled,
  ...props
}: IconButtonProps) {
  const theme = useResolvedTheme();
  const px = sizeMap[size];
  const iconSize = size === "sm" ? "sm" : size === "md" ? "md" : "lg";
  const LucideIcon = typeof icon === "string" ? getIcon(icon as IconName) : icon;

  if (!LucideIcon) return null;

  const baseStyles = variantStyles[variant](theme);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className={cn(className)}
      style={{
        width: px,
        height: px,
        borderRadius: radius.button,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "opacity 0.15s ease, filter 0.15s ease",
        ...baseStyles,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.filter = "brightness(1.1)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.filter = "";
      }}
      {...props}
    >
      <LucideIcon size={iconSize === "sm" ? 16 : iconSize === "md" ? 20 : 24} strokeWidth={2} aria-hidden />
    </button>
  );
}
