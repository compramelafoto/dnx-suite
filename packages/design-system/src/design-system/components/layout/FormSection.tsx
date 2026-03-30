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
 * - El cuerpo del recuadro limita el ancho por defecto (`form.fieldsContainerMaxWidth`); usá `fullWidth` si el bloque debe ir a todo el ancho.
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
  /**
   * Por defecto el recuadro de campos limita su ancho (`compositionSpacing.form.fieldsContainerMaxWidth`)
   * para que selects e inputs no se vean “infinitos”. Activá `true` solo si necesitás todo el ancho del modal/página.
   */
  fullWidth?: boolean;
}

export function FormSection({ title, description, children, className, style, fullWidth = false }: FormSectionProps) {
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
          <div style={{ marginTop: compositionSpacing.stack.titleToSubtitle, maxWidth: "42rem" }}>
            <Text variant="muted">{description}</Text>
          </div>
        )}
      </div>
      <div
        data-ds-form-section="body"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compositionSpacing.form.betweenFields,
          padding: compositionSpacing.form.sectionBodyPadding,
          borderRadius: "12px",
          border: `1px solid ${theme.border.subtle}`,
          background: theme.surface.elevated,
          width: "100%",
          maxWidth: fullWidth ? "100%" : compositionSpacing.form.fieldsContainerMaxWidth,
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </section>
  );
}
