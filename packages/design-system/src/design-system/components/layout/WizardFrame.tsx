"use client";

/**
 * Contenedor por slots si prefieres componer el wizard a mano (sin la API integrada de `WizardLayout`).
 * Misma estructura de scroll que el layout antiguo: header, steps, contenido con max-width, footer.
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";

export interface WizardFrameProps {
  header?: ReactNode;
  steps?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  contentMaxWidth?: string;
  className?: string;
  style?: CSSProperties;
}

export function WizardFrame({
  header,
  steps,
  children,
  footer,
  contentMaxWidth = "42rem",
  className,
  style,
}: WizardFrameProps) {
  const theme = useResolvedTheme();

  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        height: "100%",
        ...style,
      }}
    >
      {header != null && (
        <div
          style={{
            flexShrink: 0,
            padding: spacing[6],
            borderBottom: `1px solid ${theme.border.subtle}`,
          }}
        >
          {header}
        </div>
      )}

      {steps != null && (
        <div
          style={{
            flexShrink: 0,
            padding: `${spacing[4]} ${spacing[6]}`,
            borderBottom: `1px solid ${theme.border.subtle}`,
          }}
        >
          {steps}
        </div>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          padding: `${spacing[6]} ${spacing[6]}`,
        }}
      >
        <div
          style={{
            margin: "0 auto",
            width: "100%",
            maxWidth: contentMaxWidth,
          }}
        >
          {children}
        </div>
      </div>

      {footer != null && (
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: spacing[4],
            padding: spacing[6],
            borderTop: `1px solid ${theme.border.subtle}`,
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
