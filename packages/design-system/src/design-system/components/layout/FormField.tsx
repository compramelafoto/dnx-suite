"use client";

/**
 * FormField — etiqueta + control + textos de ayuda / error.
 *
 * Cuándo usar:
 * - Cada campo de formulario (input, select, textarea, grupo de radios) debe vivir dentro de un `FormField`.
 * - Espaciado: `compositionSpacing.form` (label → control, control → helper).
 *
 * Accesibilidad:
 * - Pasa `htmlFor` en el label y el mismo `id` en el input hijo (tú lo pones en el componente de input).
 *
 * Cómo estructurar formularios:
 * - Un `FormField` por control.
 * - Texto de ayuda permanente → `helperText`.
 * - Errores de validación → `errorText` (tiene prioridad visual sobre el helper).
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing, fontSize, fontWeight, fontFamily, lineHeight, compositionSpacing } from "../../tokens";
import { semanticColors } from "../../tokens/semanticActions";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface FormFieldProps {
  /** Texto del label; si `htmlFor` está definido, enlázalo al `id` del input. */
  label: ReactNode;
  htmlFor?: string;
  /** Contenido del control (Input, Select, etc.). */
  children: ReactNode;
  /** Ayuda permanente bajo el campo (no confundir con error). */
  helperText?: ReactNode;
  /** Mensaje de validación o error. */
  errorText?: ReactNode;
  /** Muestra un indicador de obligatorio junto al label. */
  required?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function FormField({
  label,
  htmlFor,
  children,
  helperText,
  errorText,
  required,
  className,
  style,
}: FormFieldProps) {
  const theme = useResolvedTheme();
  const showHelper = helperText != null && (errorText == null || errorText === "");

  return (
    <div className={cn(className)} style={{ ...style }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compositionSpacing.form.labelToControl,
        }}
      >
        <label
          htmlFor={htmlFor}
          style={{
            fontFamily: fontFamily.sans,
            fontSize: fontSize.sm,
            lineHeight: lineHeight.normal,
            fontWeight: fontWeight.semibold,
            color: theme.text.primary,
            cursor: htmlFor ? "pointer" : "default",
          }}
        >
          {label}
          {required ? (
            <span style={{ color: semanticColors.danger, marginLeft: spacing[1] }} aria-hidden>
              *
            </span>
          ) : null}
        </label>
        <div>{children}</div>
      </div>
      {errorText != null && errorText !== "" ? (
        <div style={{ marginTop: compositionSpacing.form.controlToHelper }}>
          <Text variant="helper" as="p" style={{ color: semanticColors.danger }}>
            {errorText}
          </Text>
        </div>
      ) : showHelper ? (
        <div style={{ marginTop: compositionSpacing.form.controlToHelper }}>
          <Text variant="helper" as="p">
            {helperText}
          </Text>
        </div>
      ) : null}
    </div>
  );
}
