export const HOME_BANNER_LINK_TYPES = ["EDITION", "INTERNAL", "EXTERNAL"] as const;
export type HomeBannerLinkType = (typeof HOME_BANNER_LINK_TYPES)[number];

export const HOME_BANNER_LINK_LABELS: Record<HomeBannerLinkType, string> = {
  EDITION: "Edición / maratón",
  INTERNAL: "Página interna del sitio",
  EXTERNAL: "Enlace externo (URL)",
};

export type HomeBannerFormInput = {
  title: string;
  eyebrow: string;
  description: string;
  ctaLabel: string;
  linkType: HomeBannerLinkType;
  href: string;
  editionId: string;
  imageUrl: string;
  imageUrlVertical: string;
  sortOrder: string;
  isActive: boolean;
};

export function emptyHomeBannerFormInput(): HomeBannerFormInput {
  return {
    title: "",
    eyebrow: "",
    description: "",
    ctaLabel: "Ver más",
    linkType: "INTERNAL",
    href: "",
    editionId: "",
    imageUrl: "",
    imageUrlVertical: "",
    sortOrder: "100",
    isActive: true,
  };
}

export type HomeBannerRecord = {
  id: string;
  title: string;
  eyebrow: string | null;
  description: string | null;
  ctaLabel: string;
  linkType: HomeBannerLinkType;
  href: string | null;
  editionId: string | null;
  imageUrl: string | null;
  imageUrlVertical: string | null;
  sortOrder: number;
  isActive: boolean;
  publishedAt: Date | null;
  edition?: { id: string; name: string; slug: string } | null;
};

export function bannerToFormInput(banner: HomeBannerRecord): HomeBannerFormInput {
  return {
    title: banner.title,
    eyebrow: banner.eyebrow ?? "",
    description: banner.description ?? "",
    ctaLabel: banner.ctaLabel,
    linkType: banner.linkType,
    href: banner.href ?? "",
    editionId: banner.editionId ?? "",
    imageUrl: banner.imageUrl ?? "",
    imageUrlVertical: banner.imageUrlVertical ?? "",
    sortOrder: String(banner.sortOrder),
    isActive: banner.isActive,
  };
}

/** Config del carousel (autoplay + animación horizontal). */
export type HomeBannerCarouselConfig = {
  autoplayEnabled: boolean;
  /** ms entre slides */
  autoplayMs: number;
  /** ms de la transición horizontal */
  transitionMs: number;
};

export const DEFAULT_HOME_BANNER_CAROUSEL: HomeBannerCarouselConfig = {
  autoplayEnabled: true,
  autoplayMs: 2000,
  transitionMs: 700,
};

export type HomeBannerCarouselFormInput = {
  autoplayEnabled: boolean;
  /** segundos (UI admin) */
  autoplaySeconds: string;
  /** ms (UI admin) */
  transitionMs: string;
};

export function carouselConfigToFormInput(
  config: HomeBannerCarouselConfig,
): HomeBannerCarouselFormInput {
  return {
    autoplayEnabled: config.autoplayEnabled,
    autoplaySeconds: String(Math.round((config.autoplayMs / 1000) * 10) / 10),
    transitionMs: String(config.transitionMs),
  };
}
