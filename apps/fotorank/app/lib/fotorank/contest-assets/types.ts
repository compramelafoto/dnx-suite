import type {
  ContestHeroContentPosition,
  ContestHeroHeightPreset,
  ContestHeroTextAlignment,
  ContestLogoPresentationPreset,
  ContestMediaOrientation,
} from "../contest-visual/presentation";
import type { ContestHeroOverlayStrength } from "../contest-visual/types";

/**
 * Referencia a un asset local bajo `public/contest-assets/{slug}/`.
 * `file: null` → no conectar (fallback intacto). No inventar URLs.
 */
export type ContestLocalAssetRef = {
  /** Ruta relativa al slug, p. ej. `hero/hero-desktop.webp`. */
  file: string | null;
  alt: string;
  focalPointX?: number;
  focalPointY?: number;
  orientation?: ContestMediaOrientation;
  caption?: string;
  credit?: string;
};

export type ContestLocalGalleryAssetRef = ContestLocalAssetRef & {
  order: number;
};

/**
 * Manifiesto tipado de assets locales de un concurso.
 * Independiente de la landing; reutilizable por slug.
 */
export type ContestLocalAssetsManifest = {
  slug: string;
  hero: {
    desktop: ContestLocalAssetRef;
    mobile: ContestLocalAssetRef;
    overlayStrength: ContestHeroOverlayStrength;
    minimumHeightPreset: ContestHeroHeightPreset;
    textAlignment: ContestHeroTextAlignment;
    contentPosition: ContestHeroContentPosition;
  };
  identity: {
    contestLogo: ContestLocalAssetRef;
    organizerLogo: ContestLocalAssetRef;
    secondaryLogos: ContestLocalAssetRef[];
    logoPresentationPreset: ContestLogoPresentationPreset;
  };
  editorial: {
    overview: ContestLocalAssetRef;
    categories: ContestLocalAssetRef;
    participation: ContestLocalAssetRef;
    organizer: ContestLocalAssetRef;
    prizes: ContestLocalAssetRef;
  };
  gallery: ContestLocalGalleryAssetRef[];
  social: ContestLocalAssetRef;
  onHeroForegroundColor: string;
  onHeroMutedColor: string;
};

export type ResolveLocalAssetsOptions = {
  /**
   * Predicado de existencia (selfcheck / servidor).
   * Si se omite, se asume que todo `file` no nulo está presente
   * (el validador y el selfcheck deben garantizarlo).
   */
  fileExists?: (slug: string, relativePath: string) => boolean;
};
