"use client";

/**
 * Pie fijo del wizard: borde superior, mismo fondo que el modal, acciones alineadas.
 * Izquierda: cancelar / salir. Derecha: atrás, siguiente, guardar.
 */

import type { CSSProperties, ReactNode } from "react";
import { wizardSpacing } from "../../tokens/wizardSpacing";
import { spacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";

export interface WizardFooterProps {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WizardFooter({ left, right, className, style }: WizardFooterProps) {
  const theme = useResolvedTheme();

  return (
    <footer
      className={cn(className)}
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: spacing[4],
        flexWrap: "wrap",
        padding: wizardSpacing.footerPadding,
        borderTop: `1px solid ${theme.border.subtle}`,
        background: theme.surface.base,
        ...style,
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: spacing[3],
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        {left}
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: spacing[3],
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        {right}
      </div>
    </footer>
  );
}
