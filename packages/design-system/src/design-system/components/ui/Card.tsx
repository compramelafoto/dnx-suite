"use client";

import { useState } from "react";
import type { HTMLAttributes } from "react";
import { cn } from "../../utils";
import { spacing, radius, shadows, compositionSpacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";

interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export function Card({ className, style, children, onMouseEnter, onMouseLeave, ...props }: CardProps) {
  const theme = useResolvedTheme();
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className={cn(className)}
      style={{
        background: theme.surface.base,
        border: `1px solid ${hovered ? theme.border.default : theme.border.subtle}`,
        borderRadius: radius.card,
        padding: compositionSpacing.surface.cardPadding,
        boxShadow: shadows.sm,
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        ...(hovered && { boxShadow: shadows.md }),
        ...style,
      }}
      onMouseEnter={(e) => { setHovered(true); onMouseEnter?.(e); }}
      onMouseLeave={(e) => { setHovered(false); onMouseLeave?.(e); }}
      {...props}
    >
      {children}
    </div>
  );
}
