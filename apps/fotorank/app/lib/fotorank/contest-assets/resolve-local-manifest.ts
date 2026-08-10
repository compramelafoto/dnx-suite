import type { ContestMediaAsset, ContestVisualPresentation } from "../contest-visual/presentation";
import { emptyContestVisualPresentation } from "../contest-visual/presentation";
import { isUsableContestAssetAlt } from "./alt";
import { contestAssetPublicUrl, sanitizeContestAssetRelativePath } from "./public-url";
import type {
  ContestLocalAssetRef,
  ContestLocalAssetsManifest,
  ContestLocalGalleryAssetRef,
  ResolveLocalAssetsOptions,
} from "./types";

function refToMedia(
  slug: string,
  ref: ContestLocalAssetRef,
  options?: ResolveLocalAssetsOptions,
): ContestMediaAsset | null {
  if (!ref.file) return null;
  const relative = sanitizeContestAssetRelativePath(ref.file);
  if (!relative) return null;
  if (!isUsableContestAssetAlt(ref.alt, relative)) return null;
  if (options?.fileExists && !options.fileExists(slug, relative)) return null;

  return {
    url: contestAssetPublicUrl(slug, relative),
    alt: ref.alt.trim(),
    focalPointX: ref.focalPointX ?? 50,
    focalPointY: ref.focalPointY ?? 50,
    orientation: ref.orientation,
    caption: ref.caption?.trim() || undefined,
    credit: ref.credit?.trim() || undefined,
  };
}

/** Lista rutas relativas conectadas (file no null), sin duplicar. */
export function listConnectedRelativePaths(manifest: ContestLocalAssetsManifest): string[] {
  const out: string[] = [];
  const push = (ref: ContestLocalAssetRef | null | undefined) => {
    if (!ref?.file) return;
    const relative = sanitizeContestAssetRelativePath(ref.file);
    if (relative) out.push(relative);
  };

  push(manifest.hero.desktop);
  push(manifest.hero.mobile);
  push(manifest.identity.contestLogo);
  push(manifest.identity.organizerLogo);
  for (const logo of manifest.identity.secondaryLogos) push(logo);
  push(manifest.editorial.overview);
  push(manifest.editorial.categories);
  push(manifest.editorial.participation);
  push(manifest.editorial.organizer);
  push(manifest.editorial.prizes);
  for (const item of manifest.gallery) push(item);
  push(manifest.social);
  return [...new Set(out)];
}

/**
 * Convierte un manifiesto local en ContestVisualPresentation.
 * Solo incluye assets con file válido + alt usable (+ existencia si se pasa fileExists).
 */
export function resolveLocalAssetsManifest(
  manifest: ContestLocalAssetsManifest,
  options?: ResolveLocalAssetsOptions,
): ContestVisualPresentation {
  const base = emptyContestVisualPresentation({
    overlayStrength: manifest.hero.overlayStrength,
    onHeroForegroundColor: manifest.onHeroForegroundColor,
    onHeroMutedColor: manifest.onHeroMutedColor,
  });
  const slug = manifest.slug.trim();

  const gallerySorted = [...manifest.gallery].sort((a, b) => a.order - b.order);
  const gallery: ContestMediaAsset[] = [];
  for (const item of gallerySorted) {
    const media = refToMedia(slug, item, options);
    if (media) gallery.push(media);
  }

  return {
    ...base,
    hero: {
      desktop: (() => {
        const m = refToMedia(slug, manifest.hero.desktop, options);
        if (!m) return null;
        return { ...m, objectFitDesktop: "cover" as const, objectFitMobile: "contain" as const };
      })(),
      mobile: (() => {
        const m = refToMedia(slug, manifest.hero.mobile, options);
        if (!m) return null;
        return { ...m, objectFitDesktop: "cover" as const, objectFitMobile: "contain" as const };
      })(),
      overlayStrength: manifest.hero.overlayStrength,
      minimumHeightPreset: manifest.hero.minimumHeightPreset,
      textAlignment: manifest.hero.textAlignment,
      contentPosition: manifest.hero.contentPosition,
      layout: manifest.hero.overlayStrength === "none" ? ("stacked" as const) : ("overlay" as const),
      fitDesktop: "cover",
      fitMobile: "contain",
    },
    identity: {
      contestLogo: refToMedia(slug, manifest.identity.contestLogo, options),
      organizerLogo: refToMedia(slug, manifest.identity.organizerLogo, options),
      secondaryLogos: manifest.identity.secondaryLogos
        .map((logo) => refToMedia(slug, logo, options))
        .filter((m): m is ContestMediaAsset => m != null),
      logoPresentationPreset: manifest.identity.logoPresentationPreset,
    },
    editorial: {
      overview: refToMedia(slug, manifest.editorial.overview, options),
      categories: refToMedia(slug, manifest.editorial.categories, options),
      participation: refToMedia(slug, manifest.editorial.participation, options),
      organizer: refToMedia(slug, manifest.editorial.organizer, options),
      prizes: refToMedia(slug, manifest.editorial.prizes, options),
    },
    gallery,
    social: refToMedia(slug, manifest.social, options),
    onHeroForegroundColor: manifest.onHeroForegroundColor,
    onHeroMutedColor: manifest.onHeroMutedColor,
  };
}

/** Clona un manifiesto con overrides superficiales (tests). */
export function withLocalAssetOverrides(
  manifest: ContestLocalAssetsManifest,
  patch: {
    heroDesktopFile?: string | null;
    heroMobileFile?: string | null;
    organizerLogoFile?: string | null;
    gallery?: ContestLocalGalleryAssetRef[];
    socialFile?: string | null;
  },
): ContestLocalAssetsManifest {
  return {
    ...manifest,
    hero: {
      ...manifest.hero,
      desktop: {
        ...manifest.hero.desktop,
        file: patch.heroDesktopFile !== undefined ? patch.heroDesktopFile : manifest.hero.desktop.file,
      },
      mobile: {
        ...manifest.hero.mobile,
        file: patch.heroMobileFile !== undefined ? patch.heroMobileFile : manifest.hero.mobile.file,
      },
    },
    identity: {
      ...manifest.identity,
      organizerLogo: {
        ...manifest.identity.organizerLogo,
        file:
          patch.organizerLogoFile !== undefined
            ? patch.organizerLogoFile
            : manifest.identity.organizerLogo.file,
      },
    },
    gallery: patch.gallery ?? manifest.gallery,
    social: {
      ...manifest.social,
      file: patch.socialFile !== undefined ? patch.socialFile : manifest.social.file,
    },
  };
}
