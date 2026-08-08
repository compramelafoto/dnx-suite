/**
 * Límites centralizados de assets Partners.
 * Sobreescribibles vía env en apps (no hardcodear en UI).
 */
export type PartnerAssetLimits = {
  imageMaxBytes: number;
  logoMaxBytes: number;
  svgMaxBytes: number;
  pdfMaxBytes: number;
  videoMaxBytes: number;
};

export const DEFAULT_PARTNER_ASSET_LIMITS: PartnerAssetLimits = {
  imageMaxBytes: 20 * 1024 * 1024,
  /**
   * Logos de identidad: límite alineado al body max de Vercel Serverless (~4.5 MB).
   * Si se sube más grande, el edge corta la request y el cliente ve JSON vacío.
   */
  logoMaxBytes: 4 * 1024 * 1024,
  svgMaxBytes: 5 * 1024 * 1024,
  pdfMaxBytes: 30 * 1024 * 1024,
  videoMaxBytes: 250 * 1024 * 1024,
};

export function resolvePartnerAssetLimits(
  env: Record<string, string | undefined> = {},
): PartnerAssetLimits {
  const num = (key: string, fallback: number) => {
    const raw = env[key];
    if (!raw) return fallback;
    const n = Number.parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    imageMaxBytes: num(
      "DNX_PARTNER_ASSET_IMAGE_MAX_BYTES",
      DEFAULT_PARTNER_ASSET_LIMITS.imageMaxBytes,
    ),
    logoMaxBytes: num(
      "DNX_PARTNER_LOGO_MAX_BYTES",
      DEFAULT_PARTNER_ASSET_LIMITS.logoMaxBytes,
    ),
    svgMaxBytes: num(
      "DNX_PARTNER_ASSET_SVG_MAX_BYTES",
      DEFAULT_PARTNER_ASSET_LIMITS.svgMaxBytes,
    ),
    pdfMaxBytes: num(
      "DNX_PARTNER_ASSET_PDF_MAX_BYTES",
      DEFAULT_PARTNER_ASSET_LIMITS.pdfMaxBytes,
    ),
    videoMaxBytes: num(
      "DNX_PARTNER_ASSET_VIDEO_MAX_BYTES",
      DEFAULT_PARTNER_ASSET_LIMITS.videoMaxBytes,
    ),
  };
}

/** Imágenes generales de assets (incluye JPEG legacy / materiales). */
export const PARTNER_ALLOWED_IMAGE_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
] as const;

/** Nuevos uploads clasificados como logo / identidad de marca. */
export const PARTNER_ALLOWED_LOGO_MIMES = ["image/png", "image/webp"] as const;

export const PARTNER_ALLOWED_PDF_MIMES = ["application/pdf"] as const;

export const PARTNER_ALLOWED_VIDEO_MIMES = ["video/mp4", "video/webm"] as const;

/** SVG no se acepta sin sanitización segura (Stage 01 Imp 02: rechazado). */
export const PARTNER_SVG_ENABLED = false;
