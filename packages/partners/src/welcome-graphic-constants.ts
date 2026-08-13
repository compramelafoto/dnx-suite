/**
 * Constantes welcome sin Node APIs (seguro para Client Components).
 */

/** Breakpoint canónico DS / Tailwind `md` (PublicMarketingHeader, shells). */
export const WELCOME_GRAPHIC_MEDIA_MIN_DESKTOP_PX = 768;

export const WELCOME_GRAPHIC_PURPOSE = "WELCOME_GRAPHIC" as const;

export const WELCOME_GRAPHIC_DEVICE_TARGETS = ["DESKTOP", "MOBILE"] as const;
export type WelcomeGraphicDeviceTarget = (typeof WELCOME_GRAPHIC_DEVICE_TARGETS)[number];

export const WELCOME_GRAPHIC_MOTION_VARIANTS = ["PRIMARY", "STATIC_FALLBACK"] as const;
export type WelcomeGraphicMotionVariant = (typeof WELCOME_GRAPHIC_MOTION_VARIANTS)[number];

/** Carrier Prisma existente (sin ampliar enum BrandAssetType). */
export const WELCOME_GRAPHIC_CARRIER_ASSET_TYPES = ["BRAND_PHOTO", "OTHER"] as const;

export const WELCOME_GRAPHIC_ALLOWED_MIMES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
] as const;

export type WelcomeGraphicLimits = {
  desktopStaticMaxBytes: number;
  mobileStaticMaxBytes: number;
  desktopGifMaxBytes: number;
  mobileGifMaxBytes: number;
  desktopMinWidth: number;
  desktopMinHeight: number;
  desktopMaxWidth: number;
  desktopMaxHeight: number;
  mobileMinWidth: number;
  mobileMinHeight: number;
  mobileMaxWidth: number;
  mobileMaxHeight: number;
};

export const DEFAULT_WELCOME_GRAPHIC_LIMITS: WelcomeGraphicLimits = {
  desktopStaticMaxBytes: 2 * 1024 * 1024,
  mobileStaticMaxBytes: 1 * 1024 * 1024,
  desktopGifMaxBytes: 1536 * 1024,
  mobileGifMaxBytes: 768 * 1024,
  desktopMinWidth: 600,
  desktopMinHeight: 315,
  desktopMaxWidth: 2400,
  desktopMaxHeight: 1350,
  mobileMinWidth: 600,
  mobileMinHeight: 600,
  mobileMaxWidth: 1440,
  mobileMaxHeight: 2560,
};

export type WelcomeGraphicSlotKey =
  | "WELCOME_GRAPHIC_DESKTOP"
  | "WELCOME_GRAPHIC_MOBILE"
  | "WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK"
  | "WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK";

export type WelcomeGraphicSlotGuide = {
  slotKey: WelcomeGraphicSlotKey;
  deviceTarget: WelcomeGraphicDeviceTarget;
  motionVariant: WelcomeGraphicMotionVariant;
  title: string;
  shortLabel: string;
  description: string;
  recommendation: string;
  suggestedSize: string;
  required: boolean;
};

export const WELCOME_GRAPHIC_SLOTS: readonly WelcomeGraphicSlotGuide[] = [
  {
    slotKey: "WELCOME_GRAPHIC_DESKTOP",
    deviceTarget: "DESKTOP",
    motionVariant: "PRIMARY",
    title: "Principal para escritorio",
    shortLabel: "Desktop",
    description: "Pieza horizontal que se mostrará en computadoras y pantallas amplias.",
    recommendation:
      "Proporción ~16:9 a 1.91:1 · sugerido 1200×630. Evitá botones dibujados y texto pegado a bordes. Reservá aire para la X y el CTA del sistema.",
    suggestedSize: "1200 × 630 px",
    required: false,
  },
  {
    slotKey: "WELCOME_GRAPHIC_MOBILE",
    deviceTarget: "MOBILE",
    motionVariant: "PRIMARY",
    title: "Principal para celular",
    shortLabel: "Mobile",
    description: "Pieza vertical o adaptada que se mostrará en teléfonos.",
    recommendation:
      "Proporción ~4:5 a 9:16 · sugerido 1080×1350 o 1080×1920. Debe caber en el diálogo sin tapar X ni CTA.",
    suggestedSize: "1080 × 1350 px",
    required: false,
  },
  {
    slotKey: "WELCOME_GRAPHIC_DESKTOP_STATIC_FALLBACK",
    deviceTarget: "DESKTOP",
    motionVariant: "STATIC_FALLBACK",
    title: "Fallback estático para escritorio",
    shortLabel: "Desktop estático",
    description: "Versión estática para movimiento reducido cuando la pieza desktop es GIF.",
    recommendation:
      "PNG/WebP/JPG. Misma composición que el GIF, sin animación. Obligatorio si no hay logo aprobado.",
    suggestedSize: "1200 × 630 px",
    required: false,
  },
  {
    slotKey: "WELCOME_GRAPHIC_MOBILE_STATIC_FALLBACK",
    deviceTarget: "MOBILE",
    motionVariant: "STATIC_FALLBACK",
    title: "Fallback estático para celular",
    shortLabel: "Mobile estático",
    description: "Versión estática para movimiento reducido cuando la pieza mobile es GIF.",
    recommendation:
      "PNG/WebP/JPG. Misma composición que el GIF, sin animación. Obligatorio si no hay logo aprobado.",
    suggestedSize: "1080 × 1350 px",
    required: false,
  },
] as const;

export const WELCOME_PROFILE_SECTION_TITLE = "Gráficas para ventana destacada";
export const WELCOME_PROFILE_SECTION_DESCRIPTION =
  "Piezas opcionales que pueden reemplazar al logo dentro de la ventana patrocinada. Podés cargar una versión para escritorio y otra para celular.";

export const WELCOME_GRAPHIC_SAFE_AREA_COPY =
  "Evitá texto esencial junto a bordes, no dibujes botones ni CTAs en la imagen, reservá espacio visual para la X, y recordá que el sistema agrega «Contenido patrocinado» y el CTA accesible. Probá ambas vistas antes de aprobar.";

export const WELCOME_GRAPHIC_CTA_COPY =
  "Evitá incluir botones o llamadas a la acción dentro de la imagen. El sistema agregará el CTA de forma accesible.";
