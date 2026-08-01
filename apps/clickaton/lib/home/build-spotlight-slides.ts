import { homeContent } from "@/content/home";
import { marathonPath, marathonRegistrationPath } from "@/config/navigation";
import type { HomeSpotlightSlide } from "@/components/home/HomeSpotlightBanner";
import type { PublicMarathon } from "@/types/marathon";
import {
  getHomeBannerCarouselSettings,
  listActiveHomeBannersForPublic,
} from "@/lib/admin/home-banners/queries";
import {
  DEFAULT_HOME_BANNER_CAROUSEL,
  type HomeBannerCarouselConfig,
} from "@/lib/admin/home-banners/types";
import { resolveHomeBannerHref } from "@/lib/home/resolve-banner-href";

function slidesFromEditions(editions: PublicMarathon[]): HomeSpotlightSlide[] {
  return editions
    .filter((m) => !m.isDemo)
    .slice(0, 6)
    .map((edition) => {
      const canRegister = Boolean(edition.registration?.canRegister);
      return {
        id: `edition-${edition.id}`,
        kind: "edition" as const,
        eyebrow: edition.city ? `Próxima · ${edition.city}` : "Próxima edición",
        title: edition.name,
        description: edition.shortDescription || "",
        href: canRegister
          ? marathonRegistrationPath(edition.slug)
          : marathonPath(edition.slug),
        ctaLabel: canRegister ? "Inscribirme" : "Ver edición",
        imageUrl: edition.coverImage,
        imageUrlVertical: edition.coverImageVertical,
      };
    });
}

function slidesFromStaticNews(): HomeSpotlightSlide[] {
  return homeContent.spotlightNews.map((item) => ({
    id: item.id,
    kind: "news" as const,
    eyebrow: item.eyebrow,
    title: item.title,
    description: item.description,
    href: item.href,
    ctaLabel: item.ctaLabel,
    imageUrl: item.imageUrl,
  }));
}

export type HomeSpotlightPayload = {
  slides: HomeSpotlightSlide[];
  carousel: HomeBannerCarouselConfig;
};

/**
 * Prioridad: banners admin activos.
 * Fallback: ediciones publicadas + novedades estáticas (si aún no hay banners en DB).
 */
export async function buildHomeSpotlightSlides(
  editions: PublicMarathon[],
): Promise<HomeSpotlightPayload> {
  const [bannersResult, carouselResult] = await Promise.all([
    listActiveHomeBannersForPublic(),
    getHomeBannerCarouselSettings(),
  ]);

  const carousel =
    carouselResult.ok ? carouselResult.data : DEFAULT_HOME_BANNER_CAROUSEL;

  if (bannersResult.ok && bannersResult.data.length > 0) {
    return {
      carousel,
      slides: bannersResult.data.map((banner) => {
        const canRegister = Boolean(
          banner.linkType === "EDITION" &&
            banner.edition?.registrationEnabled &&
            banner.edition?.isPublished,
        );
        const href = resolveHomeBannerHref({
          linkType: banner.linkType,
          href: banner.href,
          edition: banner.edition,
          canRegister,
        });
        return {
          id: `banner-${banner.id}`,
          kind: banner.linkType === "EDITION" ? ("edition" as const) : ("news" as const),
          eyebrow:
            banner.eyebrow || (banner.edition?.city ? `Próxima · ${banner.edition.city}` : ""),
          title: banner.title,
          description: banner.description || banner.edition?.shortDescription || "",
          href,
          ctaLabel: banner.ctaLabel,
          imageUrl: banner.imageUrl || banner.edition?.coverImageUrl || undefined,
          imageUrlVertical:
            banner.imageUrlVertical || banner.edition?.coverImageVerticalUrl || undefined,
        };
      }),
    };
  }

  return {
    carousel,
    slides: [...slidesFromEditions(editions), ...slidesFromStaticNews()],
  };
}
