/**
 * Configuración visual editable de la página pública (por concurso).
 * Persistida en `FotorankContest.publicPageVisualJson`. Sin CSS/HTML/scripts arbitrarios.
 */

import type { ContestHeroOverlayStrength, ContestVisualThemePartial } from "./types";
import type { ContestVisualPresentationPartial } from "./presentation";
import { hasUsableImageUrl } from "./url";

export const PUBLIC_PAGE_VISUAL_VERSION = 1 as const;

export type ContestHeroLayoutMode = "overlay" | "stacked";
export type ContestHeroObjectFit = "cover" | "contain";

export type PublicPageVisualConfig = {
  v: typeof PUBLIC_PAGE_VISUAL_VERSION;
  primaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  foregroundColor?: string;
  surfaceColor?: string;
  /** URL pública del banner (storage gestionado o path estático). */
  bannerUrl?: string | null;
  /** Si true, no usar coverImageUrl como hero aunque no haya banner propio. */
  bannerCleared?: boolean;
  heroLayout?: ContestHeroLayoutMode;
  heroFitDesktop?: ContestHeroObjectFit;
  heroFitMobile?: ContestHeroObjectFit;
  heroFocalX?: number;
  heroFocalY?: number;
  heroOverlayStrength?: ContestHeroOverlayStrength;
};

export type PublicPageVisualValidationError = {
  field: string;
  message: string;
};

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

const OVERLAY_VALUES = new Set<ContestHeroOverlayStrength>(["none", "soft", "medium", "strong"]);
const LAYOUT_VALUES = new Set<ContestHeroLayoutMode>(["overlay", "stacked"]);
const FIT_VALUES = new Set<ContestHeroObjectFit>(["cover", "contain"]);

/** Contraste relativo WCAG (sRGB). */
export function relativeLuminance(hex: string): number {
  const m = HEX_RE.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const srgb = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * srgb[0]! + 0.7152 * srgb[1]! + 0.0722 * srgb[2]!;
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function isValidHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_RE.test(value.trim());
}

export function normalizeHexColor(value: string): string {
  return value.trim().toLowerCase();
}

function clampFocal(n: unknown, fallback: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, Math.round(n)));
}

/**
 * Parsea y sanea JSON de DB. Devuelve null si vacío / inválido estructuralmente
 * (no lanza: la landing no debe romperse).
 */
export function parsePublicPageVisualJson(raw: unknown): PublicPageVisualConfig | null {
  if (raw == null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  if (o.v !== 1 && o.v !== PUBLIC_PAGE_VISUAL_VERSION) {
    // Aceptar objetos sin versión solo si tienen al menos un color conocido (migración suave).
    const hasAny =
      isValidHexColor(o.primaryColor) ||
      isValidHexColor(o.backgroundColor) ||
      typeof o.bannerUrl === "string";
    if (!hasAny) return null;
  }

  const out: PublicPageVisualConfig = { v: PUBLIC_PAGE_VISUAL_VERSION };

  if (isValidHexColor(o.primaryColor)) out.primaryColor = normalizeHexColor(o.primaryColor);
  if (isValidHexColor(o.accentColor)) out.accentColor = normalizeHexColor(o.accentColor);
  if (isValidHexColor(o.backgroundColor)) out.backgroundColor = normalizeHexColor(o.backgroundColor);
  if (isValidHexColor(o.foregroundColor)) out.foregroundColor = normalizeHexColor(o.foregroundColor);
  if (isValidHexColor(o.surfaceColor)) out.surfaceColor = normalizeHexColor(o.surfaceColor);

  if (o.bannerUrl === null) {
    out.bannerUrl = null;
  } else if (typeof o.bannerUrl === "string" && hasUsableImageUrl(o.bannerUrl)) {
    out.bannerUrl = o.bannerUrl.trim();
  }

  if (o.bannerCleared === true) out.bannerCleared = true;

  if (typeof o.heroLayout === "string" && LAYOUT_VALUES.has(o.heroLayout as ContestHeroLayoutMode)) {
    out.heroLayout = o.heroLayout as ContestHeroLayoutMode;
  }
  if (typeof o.heroFitDesktop === "string" && FIT_VALUES.has(o.heroFitDesktop as ContestHeroObjectFit)) {
    out.heroFitDesktop = o.heroFitDesktop as ContestHeroObjectFit;
  }
  if (typeof o.heroFitMobile === "string" && FIT_VALUES.has(o.heroFitMobile as ContestHeroObjectFit)) {
    out.heroFitMobile = o.heroFitMobile as ContestHeroObjectFit;
  }
  if (typeof o.heroOverlayStrength === "string" && OVERLAY_VALUES.has(o.heroOverlayStrength as ContestHeroOverlayStrength)) {
    out.heroOverlayStrength = o.heroOverlayStrength as ContestHeroOverlayStrength;
  }

  if (o.heroFocalX !== undefined) out.heroFocalX = clampFocal(o.heroFocalX, 50);
  if (o.heroFocalY !== undefined) out.heroFocalY = clampFocal(o.heroFocalY, 50);

  return out;
}

/**
 * Valida input del panel admin antes de persistir.
 * Rechaza colores inválidos y contrastes AA insuficientes texto/fondo.
 */
export function validatePublicPageVisualInput(
  input: Partial<PublicPageVisualConfig>,
): { ok: true; value: PublicPageVisualConfig } | { ok: false; errors: PublicPageVisualValidationError[] } {
  const errors: PublicPageVisualValidationError[] = [];

  const colorFields = [
    "primaryColor",
    "accentColor",
    "backgroundColor",
    "foregroundColor",
    "surfaceColor",
  ] as const;

  const cleaned: PublicPageVisualConfig = { v: PUBLIC_PAGE_VISUAL_VERSION };

  for (const key of colorFields) {
    const raw = input[key];
    if (raw == null || raw === "") continue;
    if (!isValidHexColor(raw)) {
      errors.push({ field: key, message: "Usá un color hexadecimal de 6 dígitos (#RRGGBB)." });
      continue;
    }
    cleaned[key] = normalizeHexColor(raw);
  }

  if (input.bannerUrl === null) {
    cleaned.bannerUrl = null;
  } else if (typeof input.bannerUrl === "string" && input.bannerUrl.trim()) {
    if (!hasUsableImageUrl(input.bannerUrl)) {
      errors.push({ field: "bannerUrl", message: "La URL del banner no es válida." });
    } else {
      cleaned.bannerUrl = input.bannerUrl.trim();
    }
  }

  if (input.bannerCleared === true) cleaned.bannerCleared = true;

  if (input.heroLayout != null) {
    if (!LAYOUT_VALUES.has(input.heroLayout)) {
      errors.push({ field: "heroLayout", message: "Layout de hero no permitido." });
    } else {
      cleaned.heroLayout = input.heroLayout;
    }
  }
  if (input.heroFitDesktop != null) {
    if (!FIT_VALUES.has(input.heroFitDesktop)) {
      errors.push({ field: "heroFitDesktop", message: "Ajuste de imagen no permitido." });
    } else {
      cleaned.heroFitDesktop = input.heroFitDesktop;
    }
  }
  if (input.heroFitMobile != null) {
    if (!FIT_VALUES.has(input.heroFitMobile)) {
      errors.push({ field: "heroFitMobile", message: "Ajuste de imagen no permitido." });
    } else {
      cleaned.heroFitMobile = input.heroFitMobile;
    }
  }
  if (input.heroOverlayStrength != null) {
    if (!OVERLAY_VALUES.has(input.heroOverlayStrength)) {
      errors.push({ field: "heroOverlayStrength", message: "Intensidad de overlay no permitida." });
    } else {
      cleaned.heroOverlayStrength = input.heroOverlayStrength;
    }
  }

  if (input.heroFocalX !== undefined) cleaned.heroFocalX = clampFocal(input.heroFocalX, 50);
  if (input.heroFocalY !== undefined) cleaned.heroFocalY = clampFocal(input.heroFocalY, 50);

  const bg = cleaned.backgroundColor;
  const fg = cleaned.foregroundColor;
  if (bg && fg && contrastRatio(bg, fg) < 4.5) {
    errors.push({
      field: "foregroundColor",
      message: "El contraste entre texto y fondo debe ser al menos 4.5:1 (WCAG AA).",
    });
  }

  const primary = cleaned.primaryColor;
  if (primary && bg && contrastRatio(primary, bg) < 3) {
    errors.push({
      field: "primaryColor",
      message: "El color principal debe contrastar al menos 3:1 con el fondo (UI).",
    });
  }

  if (errors.length) return { ok: false, errors };
  return { ok: true, value: cleaned };
}

/** Convierte config DB → partial de tema + presentación. */
export function publicPageVisualToThemePartial(
  config: PublicPageVisualConfig | null | undefined,
): ContestVisualThemePartial | null {
  if (!config) return null;

  const presentation: ContestVisualPresentationPartial = {};
  const hero: NonNullable<ContestVisualPresentationPartial["hero"]> = {};

  if (config.heroOverlayStrength) hero.overlayStrength = config.heroOverlayStrength;
  if (config.heroLayout) hero.layout = config.heroLayout;
  if (config.heroFitDesktop) hero.fitDesktop = config.heroFitDesktop;
  if (config.heroFitMobile) hero.fitMobile = config.heroFitMobile;

  if (config.bannerUrl && hasUsableImageUrl(config.bannerUrl)) {
    const asset = {
      url: config.bannerUrl.trim(),
      alt: "Banner de la página pública del concurso",
      focalPointX: config.heroFocalX ?? 78,
      focalPointY: config.heroFocalY ?? 45,
      orientation: "landscape" as const,
      objectFitDesktop: config.heroFitDesktop ?? "cover",
      objectFitMobile: config.heroFitMobile ?? "contain",
    };
    hero.desktop = asset;
    hero.mobile = { ...asset };
  } else if (config.bannerCleared) {
    hero.desktop = null;
    hero.mobile = null;
  }

  if (Object.keys(hero).length) presentation.hero = hero;

  if (config.foregroundColor && config.heroLayout === "stacked") {
    presentation.onHeroForegroundColor = config.foregroundColor;
    presentation.onHeroMutedColor = config.foregroundColor;
  }

  const partial: ContestVisualThemePartial = {
    presentation: Object.keys(presentation).length ? presentation : undefined,
  };

  if (config.primaryColor) {
    partial.primaryColor = config.primaryColor;
    const lum = relativeLuminance(config.primaryColor);
    partial.primaryForegroundColor = lum > 0.45 ? "#0a0a0a" : "#ffffff";
  }
  if (config.accentColor) {
    partial.focusColor = config.accentColor;
    partial.secondaryColor = config.accentColor;
  }
  if (config.backgroundColor) partial.backgroundColor = config.backgroundColor;
  if (config.foregroundColor) partial.foregroundColor = config.foregroundColor;
  if (config.surfaceColor) {
    partial.surfaceColor = config.surfaceColor;
    partial.surfaceElevatedColor = config.surfaceColor;
  }
  if (config.heroOverlayStrength) partial.heroOverlayStrength = config.heroOverlayStrength;

  const hasTheme =
    partial.primaryColor ||
    partial.backgroundColor ||
    partial.foregroundColor ||
    partial.surfaceColor ||
    partial.focusColor ||
    partial.presentation;
  return hasTheme ? partial : null;
}

export function emptyPublicPageVisualDefaults(): PublicPageVisualConfig {
  return { v: PUBLIC_PAGE_VISUAL_VERSION };
}
