"use client";

/**
 * FormSection — agrupa campos relacionados con título y descripción opcional.
 *
 * Cuándo usar:
 * - Dentro de formularios o pasos de wizard para separar bloques lógicos
 *   ("Datos generales", "Fechas", "Premios").
 *
 * Cómo estructurar formularios:
 * - Orden: varias `FormSection` → dentro, `FormField` por cada campo.
 * - Título breve (`title`); descripción opcional para contexto (`description`).
 * - Evita anidar secciones más de un nivel; si hace falta, usa otro título h3 vía `Text`.
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing, compositionSpacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface FormSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function FormSection({ title, description, children, className, style }: FormSectionProps) {
  const theme = useResolvedTheme();

  return (
    <section
      className={cn(className)}
      style={{
        marginBottom: compositionSpacing.stack.block,
        ...style,
      }}
    >
      <div style={{ marginBottom: compositionSpacing.form.sectionTitleToFields }}>
        <Text variant="h3" as="h3">
          {title}
        </Text>
        {description != null && (
          <div style={{ marginTop: compositionSpacing.stack.titleToSubtitle }}>
            <Text variant="muted">{description}</Text>
          </div>
        )}
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compositionSpacing.form.betweenFields,
          padding: spacing[8],
          borderRadius: "12px",
          border: `1px solid ${theme.border.subtle}`,
          background: theme.surface.elevated,
        }}
      >
        {children}
      </div>
    </section>
  );
}
