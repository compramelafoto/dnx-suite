/**
 * Tipografía base compartida.
 * Familia única, estilos para display, headings y body.
 */

export const fontFamily = {
  sans: "Inter, ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'",
} as const;

export const fontSize = {
  xs: "0.75rem", // 12px
  sm: "0.875rem", // 14px
  base: "1rem", // 16px
  lg: "1.125rem", // 18px
  xl: "1.25rem", // 20px
  "2xl": "1.5rem", // 24px
  "3xl": "1.875rem", // 30px
  "4xl": "2.25rem", // 36px
  "5xl": "3rem", // 48px
} as const;

export const lineHeight = {
  tight: "1.25",
  snug: "1.375",
  normal: "1.5",
  relaxed: "1.625",
  loose: "1.75",
} as const;

export const fontWeight = {
  normal: "400",
  medium: "500",
  semibold: "600",
  bold: "700",
} as const;

export const typography = {
  display: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize["4xl"],
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h1: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize["3xl"],
    lineHeight: lineHeight.tight,
    fontWeight: fontWeight.bold,
  },
  h2: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize["2xl"],
    lineHeight: lineHeight.snug,
    fontWeight: fontWeight.semibold,
  },
  h3: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xl,
    lineHeight: lineHeight.snug,
    fontWeight: fontWeight.semibold,
  },
  body: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.base,
    lineHeight: lineHeight.relaxed,
    fontWeight: fontWeight.normal,
  },
  bodySmall: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
  },
  small: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
  },
  /**
   * Texto secundario (descripciones, metadatos, menos jerarquía que body).
   * Misma escala que bodySmall; usar siempre vía `<Text variant="muted">` o tokens, no fontSize suelto.
   */
  muted: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.sm,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
  },
  /**
   * Ayuda bajo campos, leyendas pequeñas, mensajes de error cortos.
   * No usar para párrafos largos; preferir `body` o `muted`.
   */
  helper: {
    fontFamily: fontFamily.sans,
    fontSize: fontSize.xs,
    lineHeight: lineHeight.normal,
    fontWeight: fontWeight.normal,
  },
} as const;

export type Typography = typeof typography;

/** Variantes semánticas para UI de formularios y pantallas (evitar tamaños arbitrarios). */
export const textUiVariants = ["h1", "h2", "h3", "body", "muted", "helper"] as const;
export type TextUiVariant = (typeof textUiVariants)[number];
