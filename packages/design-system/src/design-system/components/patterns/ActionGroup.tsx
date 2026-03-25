"use client";

/**
 * Fila de acciones (botones / enlaces) con gap consistente.
 * `variant="footer"`: separa del contenido con borde y aire (modal / wizard / formulario).
 */

import type { CSSProperties, ReactNode } from "react";
import { compositionSpacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";

export interface ActionGroupProps {
  children: ReactNode;
  /** `footer` = borde superior + margen/padding según compositionSpacing.stack.contentToActions */
  variant?: "plain" | "footer";
  justify?: "start" | "center" | "end" | "between";
  className?: string;
  style?: CSSProperties;
}

const justifyMap = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  between: "space-between",
} as const;

export function ActionGroup({
  children,
  variant = "plain",
  justify = "end",
  className,
  style,
}: ActionGroupProps) {
  const theme = useResolvedTheme();
  const isFooter = variant === "footer";

  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: compositionSpacing.horizontal.actionGapComfort,
        justifyContent: justifyMap[justify],
        ...(isFooter && {
          marginTop: compositionSpacing.stack.contentToActions,
          paddingTop: compositionSpacing.stack.block,
          borderTop: `1px solid ${theme.border.subtle}`,
        }),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
