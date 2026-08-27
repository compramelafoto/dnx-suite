import type {
  ContestMediaAsset,
  ContestVisualPresentation,
  ContestVisualPresentationPartial,
} from "./presentation";
import type { ContestHeroOverlayStrength, ContestVisualTheme } from "./types";
import { hasUsableImageUrl } from "./url";

function mediaFromUrl(
  url: string | null | undefined,
  alt: string,
  extras?: Partial<ContestMediaAsset>,
): ContestMediaAsset | null {
  if (!hasUsableImageUrl(url)) return null;
  return {
    url: url!.trim(),
    alt,
    focalPointX: extras?.focalPointX ?? 50,
    focalPointY: extras?.focalPointY ?? 50,
    orientation: extras?.orientation,
    credit: extras?.credit,
    caption: extras?.caption,
  };
}

export function mergePresentation(
  base: ContestVisualPresentation,
  override?: ContestVisualPresentationPartial | null,
): ContestVisualPresentation {
  if (!override) return base;
  return {
    hero: { ...base.hero, ...override.hero },
    identity: {
      ...base.identity,
      ...override.identity,
      secondaryLogos: override.identity?.secondaryLogos ?? base.identity.secondaryLogos,
    },
    editorial: { ...base.editorial, ...override.editorial },
    gallery: override.gallery ?? base.gallery,
    social: override.social !== undefined ? override.social : base.social,
    onHeroForegroundColor: override.onHeroForegroundColor ?? base.onHeroForegroundColor,
    onHeroMutedColor: override.onHeroMutedColor ?? base.onHeroMutedColor,
  };
}

/**
 * Imagen cargada desde el administrador para este concurso.
 * Ver `lib/fotorank/contest-media`.
 */
export type ManagedContestMedia = {
  url: string;
  alt: string;
  focalPointX?: number;
  focalPointY?: number;
};

export type PresentationRuntimeOverride = {
  coverImageUrl?: string | null;
  organizerLogoUrl?: string | null;
  contestTitle?: string;
  organizerName?: string;
  /**
   * Imágenes cargadas a mano desde el administrador.
   *
   * A diferencia de `coverImageUrl`, que sólo rellena huecos, estas GANAN sobre
   * el manifiesto del preset: si alguien se tomó el trabajo de subir un banner
   * para el concurso, esa decisión es más reciente y más deliberada que la del
   * archivo que quedó fijado en el código.
   */
  managed?: {
    banner?: ManagedContestMedia | null;
    card?: ManagedContestMedia | null;
    social?: ManagedContestMedia | null;
  } | null;
};

/**
 * Completa la presentación con URLs runtime (DB) sin pisar assets ya configurados en preset.
 * Excepción: `runtime.managed` sí pisa, por lo explicado en el tipo.
 */
export function applyRuntimeMedia(
  presentation: ContestVisualPresentation,
  runtime: PresentationRuntimeOverride,
): ContestVisualPresentation {
  const title = runtime.contestTitle?.trim() || "Concurso";
  const org = runtime.organizerName?.trim() || "Organizador";
  const cover = mediaFromUrl(runtime.coverImageUrl, `Imagen de portada de ${title}`, {
    orientation: "landscape",
  });
  const orgLogo = mediaFromUrl(runtime.organizerLogoUrl, `Logo de ${org}`);

  const managedBanner = managedToAsset(runtime.managed?.banner);
  const managedSocial = managedToAsset(runtime.managed?.social);

  return {
    ...presentation,
    hero: {
      ...presentation.hero,
      /* El banner cargado a mano gana; el `cover` de la fila sigue siendo el último recurso. */
      desktop: managedBanner ?? presentation.hero.desktop ?? cover,
      mobile: managedBanner ?? presentation.hero.mobile ?? cover,
    },
    identity: {
      ...presentation.identity,
      organizerLogo: presentation.identity.organizerLogo ?? orgLogo,
    },
    social: managedSocial ?? presentation.social,
  };
}

function managedToAsset(media: ManagedContestMedia | null | undefined): ContestMediaAsset | null {
  if (!media || !hasUsableImageUrl(media.url)) return null;
  return {
    url: media.url.trim(),
    alt: media.alt,
    focalPointX: media.focalPointX ?? 50,
    focalPointY: media.focalPointY ?? 50,
    orientation: "landscape",
  };
}

export function resolveHeroAsset(
  presentation: ContestVisualPresentation,
  viewport: "desktop" | "mobile",
): ContestMediaAsset | null {
  if (viewport === "mobile") {
    return presentation.hero.mobile ?? presentation.hero.desktop;
  }
  return presentation.hero.desktop ?? presentation.hero.mobile;
}

export function presentationOverlayStrength(
  theme: ContestVisualTheme,
): ContestHeroOverlayStrength {
  return theme.presentation.hero.overlayStrength || theme.heroOverlayStrength;
}

/** Filtra galería: solo ítems con URL usable y alt no vacío. */
export function usableGallery(items: ContestMediaAsset[]): ContestMediaAsset[] {
  return items.filter((i) => hasUsableImageUrl(i.url) && i.alt.trim().length > 0);
}
