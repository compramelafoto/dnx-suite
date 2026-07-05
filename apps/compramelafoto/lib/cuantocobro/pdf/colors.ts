import { rgb, type RGB } from "pdf-lib";

/** Mismo valor que `PHOTOGRAPHER_VISUAL_IDENTITY_DEFAULTS.primaryColor` (lib/photographer/visual-identity.ts). */
const DEFAULT_ACCENT_HEX = "#c27b3d";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

/** Convierte `#RGB`, `#RRGGBB` o `RRGGBB` a color pdf-lib. */
export function parseHexColor(hex: string, fallback: RGB = rgb(0.09, 0.09, 0.09)): RGB {
  const normalized = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(normalized)) {
    return fallback;
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : normalized;

  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;

  return rgb(clamp01(r), clamp01(g), clamp01(b));
}

export function buildPdfDocumentColors(accentColorHex?: string | null): {
  textPrimary: RGB;
  textSecondary: RGB;
  textMuted: RGB;
  border: RGB;
  softBackground: RGB;
  accent: RGB;
  success: RGB;
  accentColorHex: string;
} {
  const accentHex = accentColorHex?.trim() || DEFAULT_ACCENT_HEX;
  const accent = parseHexColor(accentHex, parseHexColor("#c27b3d"));

  return {
    textPrimary: rgb(0.09, 0.11, 0.15),
    textSecondary: rgb(0.2, 0.24, 0.28),
    textMuted: rgb(0.45, 0.5, 0.55),
    border: rgb(0.88, 0.9, 0.92),
    softBackground: rgb(0.98, 0.99, 0.99),
    accent,
    success: rgb(0.09, 0.64, 0.29),
    accentColorHex: accentHex,
  };
}
