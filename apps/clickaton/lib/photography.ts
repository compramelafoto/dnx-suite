/**
 * Sistema fotográfico Clickaton — contratos y presets de variante.
 * Sin URLs remotas. Los assets reales se registran localmente.
 */

export type PhotoOverlayStrength = "none" | "soft" | "medium" | "strong";

export type PhotoVariant =
  | "hero"
  | "editorial"
  | "card"
  | "gallery"
  | "portrait"
  | "jury"
  | "sponsor-feature"
  | "background"
  | "thumbnail";

/**
 * Descriptor mínimo de un asset fotográfico local.
 * No inventar credit/source si no existen.
 */
export type PhotoAsset = {
  src: string;
  alt: string;
  credit?: string;
  source?: string;
  caption?: string;
  width?: number;
  height?: number;
};

export type PhotoVariantPreset = {
  aspectClass: string;
  /** Relación de aspecto recomendada (documentación / generación). */
  aspectRatio: string;
  recommendedSize: string;
  objectFit: "cover" | "contain";
  defaultOverlay: PhotoOverlayStrength;
  defaultSizes: string;
  radius: "none" | "card" | "control";
  bordered: boolean;
  hoverScale: boolean;
};

export const photoVariantPresets: Record<PhotoVariant, PhotoVariantPreset> = {
  hero: {
    aspectClass: "aspect-[4/5] sm:aspect-[3/4] lg:aspect-[4/5]",
    aspectRatio: "4:5 / 3:4",
    recommendedSize: "1200×1500 (mín. 900px lado corto)",
    objectFit: "cover",
    defaultOverlay: "medium",
    defaultSizes: "(max-width: 1024px) 100vw, 480px",
    radius: "card",
    bordered: true,
    hoverScale: false,
  },
  editorial: {
    aspectClass: "aspect-[3/2]",
    aspectRatio: "3:2",
    recommendedSize: "1600×1067",
    objectFit: "cover",
    defaultOverlay: "soft",
    defaultSizes: "(max-width: 768px) 100vw, 720px",
    radius: "card",
    bordered: true,
    hoverScale: false,
  },
  card: {
    aspectClass: "aspect-[16/10]",
    aspectRatio: "16:10",
    recommendedSize: "1200×750",
    objectFit: "cover",
    defaultOverlay: "soft",
    defaultSizes: "(max-width: 768px) 100vw, 400px",
    radius: "card",
    bordered: false,
    hoverScale: true,
  },
  gallery: {
    aspectClass: "aspect-[4/3]",
    aspectRatio: "4:3 (también 3:4 vertical)",
    recommendedSize: "1200×900 / 900×1200",
    objectFit: "cover",
    defaultOverlay: "none",
    defaultSizes: "(max-width: 768px) 50vw, 33vw",
    radius: "card",
    bordered: true,
    hoverScale: true,
  },
  portrait: {
    aspectClass: "aspect-[3/4]",
    aspectRatio: "3:4",
    recommendedSize: "900×1200",
    objectFit: "cover",
    defaultOverlay: "soft",
    defaultSizes: "(max-width: 768px) 50vw, 280px",
    radius: "card",
    bordered: true,
    hoverScale: false,
  },
  jury: {
    aspectClass: "aspect-square",
    aspectRatio: "1:1",
    recommendedSize: "640×640",
    objectFit: "cover",
    defaultOverlay: "none",
    defaultSizes: "128px",
    radius: "card",
    bordered: true,
    hoverScale: false,
  },
  "sponsor-feature": {
    aspectClass: "aspect-[16/9]",
    aspectRatio: "16:9",
    recommendedSize: "1600×900",
    objectFit: "cover",
    defaultOverlay: "medium",
    defaultSizes: "(max-width: 768px) 100vw, 640px",
    radius: "card",
    bordered: true,
    hoverScale: false,
  },
  background: {
    aspectClass: "min-h-[18rem] sm:min-h-[22rem]",
    aspectRatio: "libre / full-bleed controlado",
    recommendedSize: "1920×1080+",
    objectFit: "cover",
    defaultOverlay: "strong",
    defaultSizes: "100vw",
    radius: "none",
    bordered: false,
    hoverScale: false,
  },
  thumbnail: {
    aspectClass: "aspect-square",
    aspectRatio: "1:1",
    recommendedSize: "320×320",
    objectFit: "cover",
    defaultOverlay: "none",
    defaultSizes: "96px",
    radius: "card",
    bordered: true,
    hoverScale: true,
  },
};

export function formatPhotoCredit(credit: string): string {
  const trimmed = credit.trim();
  if (!trimmed) return "";
  if (/^©|^foto:/i.test(trimmed)) return trimmed;
  return `Foto: ${trimmed}`;
}
