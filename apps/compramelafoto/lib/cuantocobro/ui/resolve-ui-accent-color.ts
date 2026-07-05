import { CC_GREEN_PRIMARY } from "../theme";

/**
 * Color de acento para la UI de ¿Cuánto Cobro? (siempre verde institucional).
 * El color de marca del fotógrafo se aplica solo al PDF vía `resolvePdfPhotographerAccentHex`.
 */
export function resolveUiAccentHex(..._sources: unknown[]): string {
  return CC_GREEN_PRIMARY;
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | null {
  const trimmed = hex.trim();
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
  if (!match) return null;

  let raw = match[1];
  if (raw.length === 3) {
    raw = raw
      .split("")
      .map((char) => char + char)
      .join("");
  }

  const value = Number.parseInt(raw, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function relativeLuminance(r: number, g: number, b: number): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function sanitizeAccentHexForUi(hex: string): string {
  const rgb = parseHexColor(hex);
  if (!rgb) return CC_GREEN_PRIMARY;

  const whiteLum = 1;
  const colorLum = relativeLuminance(rgb.r, rgb.g, rgb.b);
  const contrast = (Math.max(whiteLum, colorLum) + 0.05) / (Math.min(whiteLum, colorLum) + 0.05);

  if (contrast >= 3) {
    return hex.startsWith("#") ? hex : `#${hex}`;
  }

  const factor = 0.72;
  const darken = (value: number) => Math.max(0, Math.min(255, Math.round(value * factor)));
  const r = darken(rgb.r);
  const g = darken(rgb.g);
  const b = darken(rgb.b);

  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export { CC_GREEN_PRIMARY as CC_UI_ACCENT_FALLBACK };
