/**
 * Contrato de presentación visual de concursos públicos.
 * ETAPA 02: tipado en código, preparado para persistencia futura. Sin DB.
 */

import type { ContestHeroOverlayStrength } from "./types";

/** Punto focal 0–100 (porcentaje sobre el eje). */
export type ContestFocalPoint = {
  x: number;
  y: number;
};

export type ContestMediaOrientation = "landscape" | "portrait" | "square";

export type ContestMediaObjectFit = "cover" | "contain";

export type ContestMediaAsset = {
  url: string;
  alt: string;
  focalPointX?: number;
  focalPointY?: number;
  orientation?: ContestMediaOrientation;
  credit?: string;
  caption?: string;
  /** Ajuste desktop (banner panorámico). Default cover. */
  objectFitDesktop?: ContestMediaObjectFit;
  /** Ajuste mobile; contain evita recortar logos en banners horizontales. */
  objectFitMobile?: ContestMediaObjectFit;
};

export type ContestHeroHeightPreset = "compact" | "standard" | "tall";
export type ContestHeroTextAlignment = "start" | "center";
export type ContestHeroContentPosition = "bottom" | "center";
export type ContestLogoPresentationPreset = "mark" | "wordmark" | "stacked";
/** overlay = texto sobre la imagen; stacked = banner completo + contenido debajo (sin tapar logos). */
export type ContestHeroLayoutMode = "overlay" | "stacked";

export type ContestHeroPresentation = {
  desktop: ContestMediaAsset | null;
  mobile: ContestMediaAsset | null;
  overlayStrength: ContestHeroOverlayStrength;
  minimumHeightPreset: ContestHeroHeightPreset;
  textAlignment: ContestHeroTextAlignment;
  contentPosition: ContestHeroContentPosition;
  layout?: ContestHeroLayoutMode;
  fitDesktop?: ContestMediaObjectFit;
  fitMobile?: ContestMediaObjectFit;
};

export type ContestIdentityPresentation = {
  contestLogo: ContestMediaAsset | null;
  organizerLogo: ContestMediaAsset | null;
  secondaryLogos: ContestMediaAsset[];
  logoPresentationPreset: ContestLogoPresentationPreset;
};

export type ContestEditorialPresentation = {
  overview: ContestMediaAsset | null;
  categories: ContestMediaAsset | null;
  organizer: ContestMediaAsset | null;
  prizes: ContestMediaAsset | null;
  participation: ContestMediaAsset | null;
};

/**
 * Presentación visual completa del concurso (hero, identidad, editorial, galería, social).
 * No se persiste en DB en ETAPA 02.
 */
export type ContestVisualPresentation = {
  hero: ContestHeroPresentation;
  identity: ContestIdentityPresentation;
  editorial: ContestEditorialPresentation;
  gallery: ContestMediaAsset[];
  social: ContestMediaAsset | null;
  /** Color de texto/acento sobre imagen hero (contraste). */
  onHeroForegroundColor: string;
  onHeroMutedColor: string;
};

export type ContestVisualPresentationPartial = {
  hero?: Partial<ContestHeroPresentation>;
  identity?: Partial<ContestIdentityPresentation>;
  editorial?: Partial<ContestEditorialPresentation>;
  gallery?: ContestMediaAsset[];
  social?: ContestMediaAsset | null;
  onHeroForegroundColor?: string;
  onHeroMutedColor?: string;
};

export function emptyContestVisualPresentation(
  defaults?: Partial<Pick<ContestVisualPresentation, "onHeroForegroundColor" | "onHeroMutedColor">> & {
    overlayStrength?: ContestHeroOverlayStrength;
    layout?: ContestHeroLayoutMode;
  },
): ContestVisualPresentation {
  return {
    hero: {
      desktop: null,
      mobile: null,
      overlayStrength: defaults?.overlayStrength ?? "medium",
      minimumHeightPreset: "standard",
      textAlignment: "start",
      contentPosition: "bottom",
      layout: defaults?.layout ?? "overlay",
    },
    identity: {
      contestLogo: null,
      organizerLogo: null,
      secondaryLogos: [],
      logoPresentationPreset: "mark",
    },
    editorial: {
      overview: null,
      categories: null,
      organizer: null,
      prizes: null,
      participation: null,
    },
    gallery: [],
    social: null,
    onHeroForegroundColor: defaults?.onHeroForegroundColor ?? "#fafafa",
    onHeroMutedColor: defaults?.onHeroMutedColor ?? "#d4d4d8",
  };
}
