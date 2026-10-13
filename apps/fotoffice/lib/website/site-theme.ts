import type { CSSProperties } from "react";

/**
 * El modo oscuro del sitio público.
 *
 * Las páginas de los módulos (reservas, asociarse, tienda, portal público) están escritas con los
 * tokens del panel (`--fo-*`), que son claros. En un sitio de fondo claro eso no se nota; en uno
 * oscuro —una barbería en negro y verde— quedaban como hojas blancas pegadas en medio del sitio.
 *
 * Cuando el fondo del sitio es oscuro, el marco redefine los `--fo-*` a partir de los colores de
 * la marca, así cada página se pinta con la paleta del sitio sin tocarla una por una. Con fondo
 * claro no se toca nada: los sitios que ya existen se siguen viendo exactamente igual.
 */

type SiteColors = {
  primaryColor: string;
  backgroundColor: string;
  textColor: string;
};

function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const h = m[1]!.length === 3 ? m[1]!.split("").map((c) => c + c).join("") : m[1]!;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

/** Luminancia relativa (WCAG), entre 0 y 1. Un color que no se entiende cuenta como blanco. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 1;
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isDarkColor(hex: string): boolean {
  return relativeLuminance(hex) < 0.18;
}

/** El texto que se lee encima de un color: casi negro sobre los claros, blanco sobre los oscuros. */
export function readableTextOn(hex: string): string {
  return relativeLuminance(hex) > 0.4 ? "#0a0c0b" : "#ffffff";
}

const mezcla = (color: string, pct: number, base: string) =>
  `color-mix(in srgb, ${color} ${pct}%, ${base})`;

/**
 * Las variables `--fo-*` del modo oscuro, o un objeto vacío si el fondo del sitio es claro.
 * Incluye `background` y `color` del marco: sin ellos se veía el fondo claro del `body`.
 */
export function darkSiteThemeStyle(colors: SiteColors): CSSProperties {
  if (!isDarkColor(colors.backgroundColor)) return {};
  const bg = colors.backgroundColor;
  const text = colors.textColor;
  const primary = colors.primaryColor;
  return {
    colorScheme: "dark",
    background: bg,
    color: text,
    "--fo-bg": bg,
    "--fo-bg-elevated": mezcla(text, 6, bg),
    "--fo-surface": mezcla(text, 5, bg),
    "--fo-surface-hover": mezcla(text, 9, bg),
    "--fo-surface-muted": mezcla(text, 12, bg),
    "--fo-border": mezcla(text, 13, bg),
    "--fo-border-strong": mezcla(text, 22, bg),
    "--fo-border-muted": mezcla(text, 8, bg),
    "--fo-text": text,
    "--fo-text-secondary": mezcla(text, 82, bg),
    "--fo-muted": mezcla(text, 62, bg),
    "--fo-muted-soft": mezcla(text, 45, bg),
    "--fo-accent": primary,
    "--fo-accent-hover": mezcla(primary, 85, text),
    "--fo-accent-soft": mezcla(primary, 14, bg),
    "--fo-accent-muted": mezcla(primary, 20, bg),
    "--fo-on-accent": readableTextOn(primary),
    "--fo-code-bg": mezcla(text, 8, bg),
    "--fo-kbd-bg": mezcla(text, 6, bg),
    "--fo-danger": "#f87171",
    "--fo-danger-soft": "rgba(248, 113, 113, 0.12)",
    "--fo-danger-border": "rgba(248, 113, 113, 0.4)",
    "--fo-success": primary,
    "--fo-success-soft": mezcla(primary, 14, bg),
    "--fo-success-border": mezcla(primary, 45, bg),
    "--fo-warning": "#fbbf24",
    "--fo-warning-soft": "rgba(251, 191, 36, 0.12)",
    "--fo-warning-border": "rgba(251, 191, 36, 0.4)",
    "--fo-shadow-xs": "none",
    "--fo-shadow-sm": "none",
    "--fo-shadow-md": "0 4px 12px rgba(0, 0, 0, 0.35)",
  } as CSSProperties;
}
