/**
 * Campañas publicitarias DNX Partners — tipos, catálogo de formatos/slots y elegibilidad.
 * Independiente del rol institucional (participation).
 */

import type { DnxPartnerApplication } from "./types";
import { PartnersDomainError } from "./types";
import type { DnxPartnerPlacement } from "./tracking";

export const DNX_PARTNER_CAMPAIGN_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "PAUSED",
  "COMPLETED",
  "ARCHIVED",
] as const;
export type DnxPartnerCampaignStatus = (typeof DNX_PARTNER_CAMPAIGN_STATUSES)[number];

export const DNX_PARTNER_CAMPAIGN_GEO_SCOPES = [
  "GLOBAL",
  "COUNTRY",
  "PROVINCE",
  "CITY",
  "MULTI_CITY",
] as const;
export type DnxPartnerCampaignGeoScope = (typeof DNX_PARTNER_CAMPAIGN_GEO_SCOPES)[number];

export const DNX_PARTNER_CAMPAIGN_CONTEXT_CATEGORIES = [
  "PHOTOGRAPHY",
  "SPORTS",
  "NATURE",
  "TOURISM",
  "CULTURE",
  "EDUCATION",
  "SCHOOL",
  "SOCIAL_EVENT",
  "WEDDING",
  "XV",
  "NIGHTLIFE",
  "NEWS",
  "EVENT",
  "OTHER",
] as const;
export type DnxPartnerCampaignContextCategory =
  (typeof DNX_PARTNER_CAMPAIGN_CONTEXT_CATEGORIES)[number];

export const DNX_PARTNER_CREATIVE_FORMATS = [
  "LOGO",
  "LOGO_MARQUEE",
  "BANNER_HORIZONTAL",
  "BANNER_COMPACT",
  "BANNER_MOBILE",
  "CARD_PROMO",
  "SQUARE",
  "STORY_VERTICAL",
  "VIDEO_HORIZONTAL",
  "VIDEO_VERTICAL",
  "WELCOME_INTERSTITIAL",
  "ARTICLE_INLINE",
  "GALLERY_INLINE",
] as const;
export type DnxPartnerCreativeFormat = (typeof DNX_PARTNER_CREATIVE_FORMATS)[number];

export const DNX_PARTNER_CREATIVE_DEVICE_TARGETS = [
  "ALL",
  "DESKTOP",
  "MOBILE",
  "TABLET",
] as const;
export type DnxPartnerCreativeDeviceTarget =
  (typeof DNX_PARTNER_CREATIVE_DEVICE_TARGETS)[number];

export const DNX_PARTNER_CREATIVE_STATUSES = [
  "DRAFT",
  "PENDING_APPROVAL",
  "APPROVED",
  "PAUSED",
  "ARCHIVED",
] as const;
export type DnxPartnerCreativeStatus = (typeof DNX_PARTNER_CREATIVE_STATUSES)[number];

export const DNX_PARTNER_AD_ROTATION_MODES = [
  "STATIC",
  "RANDOM",
  "ROUND_ROBIN",
  "MARQUEE",
] as const;
export type DnxPartnerAdRotationMode = (typeof DNX_PARTNER_AD_ROTATION_MODES)[number];

/** Superficies InfoSpot. */
export const INFOSPOT_AD_PLACEMENT_KEYS = [
  "INFOSPOT_HOME_WELCOME",
  "INFOSPOT_HOME_TOP",
  "INFOSPOT_HOME_INLINE",
  "INFOSPOT_HOME_MARQUEE",
  "INFOSPOT_ARTICLE_TOP",
  "INFOSPOT_ARTICLE_INLINE",
  "INFOSPOT_ARTICLE_BOTTOM",
  "INFOSPOT_EVENT_PAGE",
  "INFOSPOT_GALLERY_INLINE",
  "INFOSPOT_FLOATING",
] as const;

/** Superficies ComprameLaFoto. */
export const CLF_AD_PLACEMENT_KEYS = [
  "CLF_HOME_WELCOME",
  "CLF_ALBUM_WELCOME",
  "CLF_HOME_PROMO",
  "CLF_GALLERY_TOP",
  "CLF_GALLERY_INLINE",
  "CLF_PHOTO_DETAIL_BELOW",
  "CLF_EVENT_PAGE",
  "CLF_CHECKOUT_SUPPORTING",
  "CLF_LOGO_MARQUEE",
] as const;

/** Superficies Clickatón (activación destacada + slider de marcas). */
export const CLICKATON_AD_PLACEMENT_KEYS = [
  "CLICKATON_HOME_WELCOME",
  "CLICKATON_EVENT_WELCOME",
  "CLICKATON_HOME_MARQUEE",
  "CLICKATON_EVENT_MARQUEE",
] as const;

/** Superficies FotoRank (activación destacada + slider de marcas). */
export const FOTORANK_AD_PLACEMENT_KEYS = [
  "FOTORANK_HOME_WELCOME",
  "FOTORANK_CONTEST_WELCOME",
  "FOTORANK_HOME_MARQUEE",
  "FOTORANK_CONTEST_MARQUEE",
] as const;

export type InfospotAdPlacementKey = (typeof INFOSPOT_AD_PLACEMENT_KEYS)[number];
export type ClfAdPlacementKey = (typeof CLF_AD_PLACEMENT_KEYS)[number];
export type ClickatonAdPlacementKey = (typeof CLICKATON_AD_PLACEMENT_KEYS)[number];
export type FotorankAdPlacementKey = (typeof FOTORANK_AD_PLACEMENT_KEYS)[number];
export type DnxPartnerAdPlacementKey =
  | InfospotAdPlacementKey
  | ClfAdPlacementKey
  | ClickatonAdPlacementKey
  | FotorankAdPlacementKey;

export type AdPlacementCatalogEntry = {
  application: DnxPartnerApplication;
  placementKey: DnxPartnerAdPlacementKey;
  name: string;
  description: string;
  allowedFormats: readonly DnxPartnerCreativeFormat[];
  deviceSupport: DnxPartnerCreativeDeviceTarget;
  maxItems: number;
  rotationMode: DnxPartnerAdRotationMode;
  trackingPlacement: DnxPartnerPlacement;
  /** Checkout y floating agresivos OFF por default. */
  isActiveDefault: boolean;
};

export const AD_PLACEMENT_CATALOG: readonly AdPlacementCatalogEntry[] = [
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_HOME_WELCOME",
    name: "Activación destacada (home)",
    description: "Modal controlado al entrar (máx. 1/24h). Clave estable — no renombrar.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "CLICKATON",
    placementKey: "CLICKATON_HOME_WELCOME",
    name: "Activación destacada (home)",
    description: "Interstitial en home Clickatón. Solo montaje explícito; flag default OFF.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "CLICKATON",
    placementKey: "CLICKATON_EVENT_WELCOME",
    name: "Activación destacada (evento/maratón)",
    description: "Interstitial en ficha de maratón/edición. No en inscripción ni pago.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "FOTO_RANK",
    placementKey: "FOTORANK_HOME_WELCOME",
    name: "Activación destacada (home)",
    description: "Interstitial en home FotoRank. Solo montaje explícito; flag default OFF.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "FOTO_RANK",
    placementKey: "FOTORANK_CONTEST_WELCOME",
    name: "Activación destacada (concurso)",
    description: "Interstitial en landing pública de concurso. No en carga/jurado/admin.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "CLICKATON",
    placementKey: "CLICKATON_HOME_MARQUEE",
    name: "Clickatón — Portada — Slider de marcas",
    description: "Franja continua de logos patrocinadores dentro de una superficie autorizada.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: true,
  },
  {
    application: "CLICKATON",
    placementKey: "CLICKATON_EVENT_MARQUEE",
    name: "Clickatón — Evento — Slider de marcas",
    description: "Franja continua de logos en ficha de evento/edición. Requiere contexto EDITION/EVENT.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: true,
  },
  {
    application: "FOTO_RANK",
    placementKey: "FOTORANK_HOME_MARQUEE",
    name: "FotoRank — Portada — Slider de marcas",
    description: "Franja continua de logos patrocinadores dentro de una superficie autorizada.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: true,
  },
  {
    application: "FOTO_RANK",
    placementKey: "FOTORANK_CONTEST_MARQUEE",
    name: "FotoRank — Concurso — Slider de marcas",
    description: "Franja continua de logos en concurso público. Requiere contexto CONTEST.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_HOME_WELCOME",
    name: "Activación destacada (home)",
    description: "Interstitial en home CLF. No montado hasta etapa de integración.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_ALBUM_WELCOME",
    name: "Activación destacada (álbum)",
    description: "Interstitial en galería/álbum público. No en checkout ni descarga.",
    allowedFormats: ["WELCOME_INTERSTITIAL", "STORY_VERTICAL", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "WELCOME",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_HOME_TOP",
    name: "Home top banner",
    description: "Bajo el hero, no dentro del slider editorial.",
    allowedFormats: ["BANNER_HORIZONTAL", "BANNER_COMPACT", "BANNER_MOBILE", "CARD_PROMO"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "RANDOM",
    trackingPlacement: "BANNER",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_HOME_INLINE",
    name: "Home inline",
    description: "Entre bloques de home (post feed / pre institucional).",
    allowedFormats: ["BANNER_HORIZONTAL", "CARD_PROMO", "BANNER_MOBILE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "RANDOM",
    trackingPlacement: "HOME_INLINE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_HOME_MARQUEE",
    name: "InfoSpot — Portada — Slider de marcas",
    description: "Franja continua de logos patrocinadores dentro de una superficie autorizada.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_ARTICLE_INLINE",
    name: "Artículo inline",
    description: "Post-cuerpo / pre-relacionados.",
    allowedFormats: ["ARTICLE_INLINE", "BANNER_HORIZONTAL", "BANNER_MOBILE", "CARD_PROMO"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "ARTICLE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_ARTICLE_TOP",
    name: "Artículo top",
    description: "Bajo cover, no sobre el título.",
    allowedFormats: ["BANNER_COMPACT", "BANNER_MOBILE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "ARTICLE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_ARTICLE_BOTTOM",
    name: "Artículo bottom",
    description: "Antes del footer de la nota.",
    allowedFormats: ["BANNER_HORIZONTAL", "CARD_PROMO", "BANNER_MOBILE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "ARTICLE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_EVENT_PAGE",
    name: "Página de evento",
    description: "Aside / stack mobile bajo datos del evento.",
    allowedFormats: ["CARD_PROMO", "BANNER_COMPACT", "BANNER_MOBILE", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "EVENT_PAGE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_GALLERY_INLINE",
    name: "Galería editorial inline",
    description: "Después de la galería, no dentro del lightbox.",
    allowedFormats: ["GALLERY_INLINE", "BANNER_HORIZONTAL", "BANNER_MOBILE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "GALLERY_INLINE",
    isActiveDefault: true,
  },
  {
    application: "INFO_SPOT",
    placementKey: "INFOSPOT_FLOATING",
    name: "Floating (reservado)",
    description: "Deshabilitado por default — agresivo en UX.",
    allowedFormats: ["CARD_PROMO", "SQUARE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "OTHER",
    isActiveDefault: false,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_HOME_PROMO",
    name: "Home promo",
    description: "Bajo hero / cerca de HomeBanner.",
    allowedFormats: ["BANNER_HORIZONTAL", "BANNER_MOBILE", "CARD_PROMO"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "RANDOM",
    trackingPlacement: "BANNER",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_GALLERY_TOP",
    name: "Galería top",
    description: "Franja superior de galería/álbum.",
    allowedFormats: ["BANNER_COMPACT", "BANNER_MOBILE"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "BANNER",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_GALLERY_INLINE",
    name: "Galería inline",
    description: "Tras N filas de thumbs; no sobre fotos.",
    allowedFormats: ["GALLERY_INLINE", "BANNER_HORIZONTAL", "BANNER_MOBILE", "CARD_PROMO"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "RANDOM",
    trackingPlacement: "GALLERY_INLINE",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_PHOTO_DETAIL_BELOW",
    name: "Detalle foto",
    description: "Debajo de la foto / controles; nunca overlay zoom.",
    allowedFormats: ["BANNER_COMPACT", "BANNER_MOBILE", "CARD_PROMO"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "PHOTO_DETAIL",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_EVENT_PAGE",
    name: "Página evento/álbum",
    description: "Zona contextual del evento.",
    allowedFormats: ["CARD_PROMO", "BANNER_COMPACT"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "EVENT_PAGE",
    isActiveDefault: true,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_CHECKOUT_SUPPORTING",
    name: "Checkout supporting",
    description: "OFF por default — no interferir compra.",
    allowedFormats: ["BANNER_COMPACT", "CARD_PROMO"],
    deviceSupport: "ALL",
    maxItems: 1,
    rotationMode: "STATIC",
    trackingPlacement: "OTHER",
    isActiveDefault: false,
  },
  {
    application: "COMPRAME_LA_FOTO",
    placementKey: "CLF_LOGO_MARQUEE",
    name: "ComprameLaFoto — Portada — Slider de marcas",
    description: "Franja continua de logos patrocinadores dentro de una superficie autorizada.",
    allowedFormats: ["LOGO", "LOGO_MARQUEE"],
    deviceSupport: "ALL",
    maxItems: 12,
    rotationMode: "MARQUEE",
    trackingPlacement: "LOGO_MARQUEE",
    isActiveDefault: true,
  },
] as const;

export const CAMPAIGN_CONTEXT_LABELS: Record<DnxPartnerCampaignContextCategory, string> = {
  PHOTOGRAPHY: "Fotografía",
  SPORTS: "Deportes",
  NATURE: "Naturaleza",
  TOURISM: "Turismo",
  CULTURE: "Cultura",
  EDUCATION: "Educación",
  SCHOOL: "Escolar",
  SOCIAL_EVENT: "Evento social",
  WEDDING: "Casamiento",
  XV: "XV años",
  NIGHTLIFE: "Nightlife",
  NEWS: "Noticias",
  EVENT: "Evento",
  OTHER: "Otro",
};

export const CREATIVE_FORMAT_LABELS: Record<DnxPartnerCreativeFormat, string> = {
  LOGO: "Logo",
  LOGO_MARQUEE: "Slider de marcas",
  BANNER_HORIZONTAL: "Banner horizontal",
  BANNER_COMPACT: "Banner compacto",
  BANNER_MOBILE: "Banner mobile",
  CARD_PROMO: "Card promo",
  SQUARE: "Cuadrado",
  STORY_VERTICAL: "Story vertical",
  VIDEO_HORIZONTAL: "Video horizontal",
  VIDEO_VERTICAL: "Video vertical",
  WELCOME_INTERSTITIAL: "Welcome / interstitial",
  ARTICLE_INLINE: "Artículo inline",
  GALLERY_INLINE: "Galería inline",
};

export type CampaignGeoAudience = {
  countryCode?: string | null;
  province?: string | null;
  city?: string | null;
};

export type CampaignEligibilityInput = {
  status: DnxPartnerCampaignStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  archivedAt?: Date | null;
  partnerArchived?: boolean;
  now?: Date;
};

export function isCampaignScheduleActive(input: CampaignEligibilityInput): boolean {
  if (input.archivedAt) return false;
  if (input.partnerArchived) return false;
  if (input.status !== "ACTIVE") return false;
  const now = input.now ?? new Date();
  if (input.startsAt && input.startsAt.getTime() > now.getTime()) return false;
  if (input.endsAt && input.endsAt.getTime() < now.getTime()) return false;
  return true;
}

export function isCreativeEligible(input: {
  status: DnxPartnerCreativeStatus;
  startsAt?: Date | null;
  endsAt?: Date | null;
  archivedAt?: Date | null;
  assetApproved?: boolean;
  now?: Date;
}): boolean {
  if (input.archivedAt) return false;
  if (input.status !== "APPROVED") return false;
  if (input.assetApproved === false) return false;
  const now = input.now ?? new Date();
  if (input.startsAt && input.startsAt.getTime() > now.getTime()) return false;
  if (input.endsAt && input.endsAt.getTime() < now.getTime()) return false;
  return true;
}

function norm(s?: string | null): string {
  return (s ?? "").trim().toLowerCase();
}

/**
 * Geo match aproximado. GLOBAL pasa siempre.
 * Sin audiencia → solo GLOBAL / campañas sin targets exclude.
 */
export function matchesCampaignGeo(input: {
  geoScope: DnxPartnerCampaignGeoScope;
  targets: readonly {
    countryCode?: string | null;
    province?: string | null;
    city?: string | null;
    include: boolean;
  }[];
  audience?: CampaignGeoAudience | null;
}): boolean {
  if (input.geoScope === "GLOBAL" && input.targets.length === 0) return true;

  const audience = input.audience;
  const includes = input.targets.filter((t) => t.include);
  const excludes = input.targets.filter((t) => !t.include);

  for (const t of excludes) {
    if (t.city && audience?.city && norm(t.city) === norm(audience.city)) return false;
    if (
      t.province &&
      !t.city &&
      audience?.province &&
      norm(t.province) === norm(audience.province)
    ) {
      return false;
    }
    if (
      t.countryCode &&
      !t.province &&
      !t.city &&
      audience?.countryCode &&
      norm(t.countryCode) === norm(audience.countryCode)
    ) {
      return false;
    }
  }

  if (includes.length === 0) {
    return input.geoScope === "GLOBAL";
  }

  if (!audience?.countryCode && !audience?.province && !audience?.city) {
    // Sin señal de ubicación: solo campañas GLOBAL sin includes estrictos city/province
    return includes.every((t) => !t.city && !t.province);
  }

  return includes.some((t) => {
    if (t.city) {
      return (
        Boolean(audience.city) &&
        norm(t.city) === norm(audience.city) &&
        (!t.province || norm(t.province) === norm(audience.province)) &&
        (!t.countryCode || norm(t.countryCode) === norm(audience.countryCode))
      );
    }
    if (t.province) {
      return (
        Boolean(audience.province) &&
        norm(t.province) === norm(audience.province) &&
        (!t.countryCode || norm(t.countryCode) === norm(audience.countryCode))
      );
    }
    if (t.countryCode) {
      return Boolean(audience.countryCode) && norm(t.countryCode) === norm(audience.countryCode);
    }
    return true;
  });
}

export function matchesCampaignContext(input: {
  targets: readonly DnxPartnerCampaignContextCategory[];
  audienceCategories?: readonly DnxPartnerCampaignContextCategory[] | null;
}): boolean {
  if (input.targets.length === 0) return true;
  if (!input.audienceCategories?.length) return true; // sin contexto → no filtrar
  const set = new Set(input.audienceCategories);
  return input.targets.some((c) => set.has(c));
}

export function matchesCreativeDevice(
  deviceTarget: DnxPartnerCreativeDeviceTarget,
  device: DnxPartnerCreativeDeviceTarget | "ALL",
): boolean {
  if (deviceTarget === "ALL" || device === "ALL") return true;
  return deviceTarget === device;
}

export function matchesCreativeFormat(
  format: DnxPartnerCreativeFormat,
  allowed: readonly DnxPartnerCreativeFormat[],
): boolean {
  return allowed.includes(format);
}

export type ResolvedAdCreative = {
  campaignId: string;
  campaignName: string;
  partnerId: string;
  partnerName: string;
  creativeId: string;
  format: DnxPartnerCreativeFormat;
  deviceTarget: DnxPartnerCreativeDeviceTarget;
  title: string | null;
  body: string | null;
  ctaText: string | null;
  imageUrl: string | null;
  /** Snapshot responsivo welcome (opcional; prioridad sobre imageUrl en UI). */
  welcomeMedia?: import("./welcome-graphic-assets").WelcomeResponsiveMediaSnapshot | null;
  href: string | null;
  priority: number;
  sortOrder: number;
  trackingPlacement: DnxPartnerPlacement;
};

export type ResolveAdsCandidate = {
  campaignId: string;
  campaignName: string;
  partnerId: string;
  partnerName: string;
  partnerArchived: boolean;
  campaignStatus: DnxPartnerCampaignStatus;
  campaignStartsAt: Date | null;
  campaignEndsAt: Date | null;
  campaignArchivedAt: Date | null;
  campaignPriority: number;
  geoScope: DnxPartnerCampaignGeoScope;
  geoTargets: readonly {
    countryCode?: string | null;
    province?: string | null;
    city?: string | null;
    include: boolean;
  }[];
  contextTargets: readonly DnxPartnerCampaignContextCategory[];
  creative: {
    id: string;
    format: DnxPartnerCreativeFormat;
    deviceTarget: DnxPartnerCreativeDeviceTarget;
    title: string | null;
    body: string | null;
    ctaText: string | null;
    status: DnxPartnerCreativeStatus;
    startsAt: Date | null;
    endsAt: Date | null;
    archivedAt: Date | null;
    sortOrder: number;
    imageUrl: string | null;
    href: string | null;
    assetApproved: boolean;
  };
  placementPriority: number;
  trackingPlacement: DnxPartnerPlacement;
  allowedFormats: readonly DnxPartnerCreativeFormat[];
};

export function resolveEligibleAds(input: {
  candidates: readonly ResolveAdsCandidate[];
  audience?: CampaignGeoAudience | null;
  audienceCategories?: readonly DnxPartnerCampaignContextCategory[] | null;
  device: DnxPartnerCreativeDeviceTarget;
  maxItems: number;
  rotationMode: DnxPartnerAdRotationMode;
  now?: Date;
  /** Seed estable para RANDOM/ROUND_ROBIN (p. ej. día + placement). */
  rotationSeed?: string;
}): ResolvedAdCreative[] {
  const now = input.now ?? new Date();
  const eligible = input.candidates.filter((c) => {
    if (
      !isCampaignScheduleActive({
        status: c.campaignStatus,
        startsAt: c.campaignStartsAt,
        endsAt: c.campaignEndsAt,
        archivedAt: c.campaignArchivedAt,
        partnerArchived: c.partnerArchived,
        now,
      })
    ) {
      return false;
    }
    if (
      !isCreativeEligible({
        status: c.creative.status,
        startsAt: c.creative.startsAt,
        endsAt: c.creative.endsAt,
        archivedAt: c.creative.archivedAt,
        assetApproved: c.creative.assetApproved,
        now,
      })
    ) {
      return false;
    }
    if (!matchesCreativeFormat(c.creative.format, c.allowedFormats)) return false;
    if (!matchesCreativeDevice(c.creative.deviceTarget, input.device)) return false;
    if (
      !matchesCampaignGeo({
        geoScope: c.geoScope,
        targets: c.geoTargets,
        audience: input.audience,
      })
    ) {
      return false;
    }
    if (
      !matchesCampaignContext({
        targets: c.contextTargets,
        audienceCategories: input.audienceCategories,
      })
    ) {
      return false;
    }
    return true;
  });

  eligible.sort((a, b) => {
    if (a.placementPriority !== b.placementPriority) {
      return a.placementPriority - b.placementPriority;
    }
    if (a.campaignPriority !== b.campaignPriority) {
      return a.campaignPriority - b.campaignPriority;
    }
    return a.creative.sortOrder - b.creative.sortOrder;
  });

  let picked = eligible;
  if (input.rotationMode === "RANDOM" && eligible.length > 1) {
    const seed = hashSeed(input.rotationSeed ?? "ads");
    picked = [...eligible].sort(
      (a, b) =>
        ((seed + hashSeed(a.creative.id)) % 997) - ((seed + hashSeed(b.creative.id)) % 997),
    );
  } else if (input.rotationMode === "ROUND_ROBIN" && eligible.length > 1) {
    const seed = hashSeed(input.rotationSeed ?? "rr");
    const offset = seed % eligible.length;
    picked = [...eligible.slice(offset), ...eligible.slice(0, offset)];
  }

  const max = Math.max(1, input.maxItems);
  return picked.slice(0, max).map((c) => ({
    campaignId: c.campaignId,
    campaignName: c.campaignName,
    partnerId: c.partnerId,
    partnerName: c.partnerName,
    creativeId: c.creative.id,
    format: c.creative.format,
    deviceTarget: c.creative.deviceTarget,
    title: c.creative.title,
    body: c.creative.body,
    ctaText: c.creative.ctaText,
    imageUrl: c.creative.imageUrl,
    href: c.creative.href,
    priority: c.placementPriority,
    sortOrder: c.creative.sortOrder,
    trackingPlacement: c.trackingPlacement,
  }));
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function assertSafeCampaignDestination(url: string): string {
  const t = url.trim();
  if (!t) throw new PartnersDomainError("VALIDATION", "destinationUrl vacío.");
  const lower = t.toLowerCase();
  if (
    lower.startsWith("javascript:") ||
    lower.startsWith("data:") ||
    lower.startsWith("vbscript:")
  ) {
    throw new PartnersDomainError("VALIDATION", "Protocolo de destino no permitido.");
  }
  if (t.startsWith("/")) return t;
  try {
    const u = new URL(t.includes("://") ? t : `https://${t}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      throw new PartnersDomainError("VALIDATION", "Solo http/https.");
    }
    return u.toString();
  } catch {
    throw new PartnersDomainError("VALIDATION", "URL de destino inválida.");
  }
}

function envFlagTruthy(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** Kill switch InfoSpot — default OFF (seguro). */
export function isInfospotPartnerAdsEnabled(): boolean {
  return envFlagTruthy("INFOSPOT_PARTNER_ADS_ENABLED");
}

/** Kill switch CLF — default OFF (seguro). */
export function isClfPartnerAdsEnabled(): boolean {
  return envFlagTruthy("CLF_PARTNER_ADS_ENABLED");
}

/**
 * Activación destacada Clickatón — default OFF.
 * Solo soporte en código; no cargar en Vercel hasta etapa de integración.
 */
export function isClickatonPartnerWelcomeEnabled(): boolean {
  return envFlagTruthy("CLICKATON_PARTNER_WELCOME_ENABLED");
}

/**
 * Activación destacada FotoRank — default OFF.
 * Solo soporte en código; no cargar en Vercel hasta etapa de integración.
 */
export function isFotorankPartnerWelcomeEnabled(): boolean {
  return envFlagTruthy("FOTORANK_PARTNER_WELCOME_ENABLED");
}

/**
 * Activación destacada CLF álbum — default OFF.
 * Requiere además `CLF_PARTNER_ADS_ENABLED` en el loader de app (ambos ON).
 */
export function isClfPartnerAlbumWelcomeEnabled(): boolean {
  return envFlagTruthy("CLF_PARTNER_ALBUM_WELCOME_ENABLED");
}

export function getAdPlacementCatalogEntry(
  application: DnxPartnerApplication,
  placementKey: string,
): AdPlacementCatalogEntry | undefined {
  return AD_PLACEMENT_CATALOG.find(
    (e) => e.application === application && e.placementKey === placementKey,
  );
}
