/**
 * Configuración de variantes públicas (thumb/preview con marca).
 * Variables de entorno con defaults orientados a uso no reutilizable en redes/sociales.
 */

export type WatermarkDensity = "normal" | "high" | "very_high";

export type PublicPhotoVariantConfig = {
  thumbMaxSide: number;
  thumbQuality: number;
  previewMaxSide: number;
  previewQuality: number;
  watermarkOpacity: number;
  watermarkDensity: WatermarkDensity;
  watermarkCenterBias: boolean;
  /** Sufijo de archivo R2: photo-variants/{id}/thumb_wm_{version}.jpg */
  fileVersion: string;
  /** Versión de caché dinámica legacy en view (bucket horario) */
  dynamicCacheVersion: string;
  fineNoiseStrength: number;
  enableFineNoise: boolean;
};

function parseIntEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseFloatEnv(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function parseDensity(raw: string | undefined): WatermarkDensity {
  const v = (raw ?? "high").trim().toLowerCase();
  if (v === "normal" || v === "high") return v;
  if (v === "very_high") return "very_high";
  return "high";
}

export function isServePregeneratedVariantsEnabled(): boolean {
  const raw = process.env.PHOTO_VARIANTS_SERVE_PREGENERATED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isGenerateVariantsOnUploadEnabled(): boolean {
  const raw = process.env.PHOTO_VARIANTS_GENERATE_ON_UPLOAD?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  return true;
}

export function getPublicPhotoVariantConfig(): PublicPhotoVariantConfig {
  return {
    thumbMaxSide: parseIntEnv("PHOTO_VARIANT_THUMB_MAX_SIDE", 260, 240, 280),
    thumbQuality: parseIntEnv("PHOTO_VARIANT_THUMB_QUALITY", 32, 28, 36),
    previewMaxSide: parseIntEnv("PHOTO_VARIANT_PREVIEW_MAX_SIDE", 640, 540, 720),
    previewQuality: parseIntEnv("PHOTO_VARIANT_PREVIEW_QUALITY", 42, 36, 48),
    watermarkOpacity: parseFloatEnv("PHOTO_WATERMARK_OPACITY", 0.4, 0.2, 0.7),
    watermarkDensity: parseDensity(process.env.PHOTO_WATERMARK_DENSITY),
    watermarkCenterBias: process.env.PHOTO_WATERMARK_CENTER_BIAS?.trim().toLowerCase() !== "false",
    fileVersion: process.env.PHOTO_VARIANT_FILE_VERSION?.trim() || "v7",
    dynamicCacheVersion: process.env.PHOTO_VARIANT_DYNAMIC_CACHE_VERSION?.trim() || "v21-from-original",
    fineNoiseStrength: parseIntEnv("PHOTO_VARIANT_FINE_NOISE_STRENGTH", 5, 2, 12),
    enableFineNoise: process.env.PHOTO_VARIANT_FINE_NOISE?.trim().toLowerCase() !== "false",
  };
}

export function thumbVariantR2Key(photoId: number, fileVersion: string): string {
  return `photo-variants/${photoId}/thumb_wm_${fileVersion}.jpg`;
}

export function previewVariantR2Key(photoId: number, fileVersion: string): string {
  return `photo-variants/${photoId}/preview_wm_${fileVersion}.jpg`;
}
