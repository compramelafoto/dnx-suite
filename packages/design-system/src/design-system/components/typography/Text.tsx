"use client";

/**
 * Text — tipografía semántica del design system.
 *
 * Cuándo usar:
 * - Siempre que necesites texto con jerarquía clara (títulos, cuerpo, ayuda).
 * - No uses `fontSize` / `lineHeight` sueltos en pantallas nuevas; elige `variant`.
 *
 * Variantes:
 * - h1, h2, h3: títulos de página, sección o subsección.
 * - body: párrafos y contenido principal.
 * - muted: descripciones, metadatos, texto de menor énfasis.
 * - helper: texto bajo inputs, hints cortos (no párrafos largos).
 */

import type { CSSProperties, ElementType, ReactNode } from "react";
import { typography, type TextUiVariant } from "../../tokens/typography";
import { useResolvedTheme } from "../../themes";
import { cn } from "../../utils";

const defaultElement: Record<TextUiVariant, ElementType> = {
  h1: "h1",
  h2: "h2",
  h3: "h3",
  body: "p",
  muted: "p",
  helper: "span",
};

export interface TextProps {
  variant: TextUiVariant;
  /** Elemento HTML semántico (por defecto según variant). */
  as?: ElementType;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function Text({ variant, as, children, className, style }: TextProps) {
  const theme = useResolvedTheme();
  const Component = (as ?? defaultElement[variant]) as ElementType;
  const typo = typography[variant];
  const color =
    variant === "muted"
      ? theme.text.secondary
      : variant === "helper"
        ? theme.text.tertiary
        : theme.text.primary;

  return (
    <Component
      className={cn(className)}
      style={{
        margin: 0,
        ...typo,
        color,
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
