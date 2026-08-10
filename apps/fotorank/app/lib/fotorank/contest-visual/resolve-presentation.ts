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
  const heroOverride = override.hero;
  let desktop = heroOverride?.desktop !== undefined ? heroOverride.desktop : base.hero.desktop;
  let mobile = heroOverride?.mobile !== undefined ? heroOverride.mobile : base.hero.mobile;

  // Focal / fit de config sin URL: aplicar sobre assets del preset.
  if (heroOverride && desktop && heroOverride.desktop === undefined) {
    desktop = {
      ...desktop,
      focalPointX: heroOverride.fitDesktop ? desktop.focalPointX : desktop.focalPointX,
      objectFitDesktop: heroOverride.fitDesktop ?? desktop.objectFitDesktop,
      objectFitMobile: heroOverride.fitMobile ?? desktop.objectFitMobile,
    };
  }
  if (heroOverride && mobile && heroOverride.mobile === undefined) {
    mobile = {
      ...mobile,
      objectFitDesktop: heroOverride.fitDesktop ?? mobile.objectFitDesktop,
      objectFitMobile: heroOverride.fitMobile ?? mobile.objectFitMobile,
    };
  }

  return {
    hero: {
      ...base.hero,
      ...heroOverride,
      desktop,
      mobile,
    },
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

export type PresentationRuntimeOverride = {
  coverImageUrl?: string | null;
  organizerLogoUrl?: string | null;
  contestTitle?: string;
  organizerName?: string;
  /** Si true, no usar coverImageUrl como fallback de hero. */
  skipCoverAsHero?: boolean;
};

/**
 * Completa la presentación con URLs runtime (DB) sin pisar assets ya configurados en preset.
 */
export function applyRuntimeMedia(
  presentation: ContestVisualPresentation,
  runtime: PresentationRuntimeOverride,
): ContestVisualPresentation {
  const title = runtime.contestTitle?.trim() || "Concurso";
  const org = runtime.organizerName?.trim() || "Organizador";
  const cover = runtime.skipCoverAsHero
    ? null
    : mediaFromUrl(runtime.coverImageUrl, `Imagen de portada de ${title}`, {
        orientation: "landscape",
        objectFitDesktop: presentation.hero.fitDesktop ?? "cover",
        objectFitMobile: presentation.hero.fitMobile ?? "contain",
      });
  const orgLogo = mediaFromUrl(runtime.organizerLogoUrl, `Logo de ${org}`);

  return {
    ...presentation,
    hero: {
      ...presentation.hero,
      desktop: presentation.hero.desktop ?? cover,
      mobile: presentation.hero.mobile ?? cover,
    },
    identity: {
      ...presentation.identity,
      organizerLogo: presentation.identity.organizerLogo ?? orgLogo,
    },
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
