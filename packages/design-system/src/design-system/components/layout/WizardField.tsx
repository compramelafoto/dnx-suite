"use client";

/**
 * Campo de formulario dentro de un wizard: label arriba, control, helper o error.
 *
 * Cuándo usar:
 * - Un `WizardField` por control (input, select, textarea, grupo).
 *
 * Espaciado: `wizardSpacing.labelToInput` (label → control), `inputToHelper` (control → ayuda/error).
 */

import type { CSSProperties, ReactNode } from "react";
import { spacing, fontSize, fontWeight, fontFamily, lineHeight } from "../../tokens";
import { semanticColors } from "../../tokens/semanticActions";
import { wizardSpacing } from "../../tokens/wizardSpacing";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";
import { Text } from "../typography/Text";

export interface WizardFieldProps {
  label: ReactNode;
  htmlFor?: string;
  children: ReactNode;
  helperText?: ReactNode;
  errorText?: ReactNode;
  required?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Error visible pero no estridente. */
const errorColorSoft = "rgba(248, 113, 113, 0.92)";

export function WizardField({
  label,
  htmlFor,
  children,
  helperText,
  errorText,
  required,
  className,
  style,
}: WizardFieldProps) {
  const theme = useResolvedTheme();
  const showHelper = helperText != null && (errorText == null || errorText === "");

  return (
    <div className={cn(className)} style={{ ...style }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: wizardSpacing.labelToInput,
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
      {(errorText != null && errorText !== "") || showHelper ? (
        <div style={{ marginTop: wizardSpacing.inputToHelper }}>
          {errorText != null && errorText !== "" ? (
            <Text variant="helper" as="p" style={{ color: errorColorSoft }}>
              {errorText}
            </Text>
          ) : (
            <Text variant="helper" as="p" style={{ color: theme.text.tertiary }}>
              {helperText}
            </Text>
          )}
        </div>
      ) : null}
    </div>
  );
}
