"use client";

/**
 * Bloque interno dentro de un paso (agrupa campos relacionados).
 *
 * Cuándo usar:
 * - Para separar grupos lógicos ("Datos generales", "Visibilidad") dentro del mismo paso.
 * - No sustituye pasos del stepper: un paso puede contener varias `WizardSection`.
 */

import type { CSSProperties, ReactNode } from "react";
import { wizardSpacing } from "../../tokens/wizardSpacing";
import { spacing, compositionSpacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface WizardSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function WizardSection({ title, description, children, className, style }: WizardSectionProps) {
  const theme = useResolvedTheme();

  return (
    <section
      className={cn(className)}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: compositionSpacing.stack.subtitleToContent,
        padding: spacing[6],
        borderRadius: "12px",
        border: `1px solid ${theme.border.subtle}`,
        background: theme.surface.elevated,
        boxSizing: "border-box",
        ...style,
      }}
    >
      <div>
        <Text variant="h3" as="h3">
          {title}
        </Text>
        {description != null && (
          <div style={{ marginTop: wizardSpacing.stepTitleToDescription }}>
            <Text variant="muted" as="p">
              {description}
            </Text>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: wizardSpacing.betweenFields,
        }}
      >
        {children}
      </div>
    </section>
  );
}
