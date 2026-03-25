"use client";

import type { HTMLAttributes } from "react";
import { cn } from "../../utils";
import { spacing, radius } from "../../tokens";
import { useResolvedTheme } from "../../themes";

type BadgeVariant = "default" | "success" | "warning" | "error" | "neutral";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({
  variant = "default",
  className,
  style,
  children,
  ...props
}: BadgeProps) {
  const theme = useResolvedTheme();
  const isDark = theme.mode === "dark";

  const variantStyles: Record<BadgeVariant, React.CSSProperties> = {
    default: {
      background: isDark ? "rgba(255, 255, 255, 0.12)" : "rgba(0, 0, 0, 0.08)",
      color: theme.text.primary,
    },
    success: {
      background: "rgba(34, 197, 94, 0.28)",
      color: "#86efac",
    },
    warning: {
      background: "rgba(234, 179, 8, 0.28)",
      color: "#fde047",
    },
    error: {
      background: "rgba(239, 68, 68, 0.28)",
      color: "#fca5a5",
    },
    neutral: {
      background: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(0, 0, 0, 0.06)",
      color: theme.text.secondary,
    },
  };

  return (
    <span
      className={cn(className)}
      style={{
        padding: `${spacing[1]} ${spacing[3]}`,
        borderRadius: radius.pill,
        fontSize: "0.75rem",
        fontWeight: 500,
        ...variantStyles[variant],
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  );
}
