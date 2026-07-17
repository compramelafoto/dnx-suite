/**
 * Adaptador puro: FotorankPublicEvent(V1) → PublicMarathon.
 * Sin React, sin fetch, sin Prisma.
 */

import type {
  FotorankPublicCapabilitiesV1,
  FotorankPublicEventListItemV1,
  FotorankPublicEventV1,
  FotorankPublicJuryMemberV1,
} from "@/data/public-marathons/fotorank-v1-types";
import {
  mapFotorankGalleryStatus,
  mapFotorankRegistrationStatus,
  mapFotorankResultsStatus,
  mapFotorankStatusToMarathonStatus,
} from "@/data/public-marathons/map-fotorank-status";
import type {
  PublicCategory,
  PublicJuryMember,
  PublicMarathon,
  PublicOrganizer,
  PublicPrize,
  PublicRulesDocument,
  PublicScheduleItem,
  PublicSponsor,
} from "@/types/marathon";
import type { PublicMarathonCapabilities } from "@/types/public";
import type { PublicRegistrationSummary } from "@/types/public/registration";

function mapRegistration(
  registration:
    | FotorankPublicEventV1["registration"]
    | FotorankPublicEventListItemV1["registration"]
    | undefined,
): PublicRegistrationSummary | undefined {
  if (!registration) return undefined;
  return {
    mode: registration.mode,
    status: registration.status,
    canRegister: registration.canRegister,
    displayPrice: registration.displayPrice
      ? {
          amountMinor: registration.displayPrice.amountMinor,
          currency: registration.displayPrice.currency,
          formatted: registration.displayPrice.formatted,
        }
      : null,
    hasOptionalMerchandise: registration.hasOptionalMerchandise,
    registrationUrl: registration.registrationUrl,
    checkoutUrl: registration.checkoutUrl,
    opensAt: registration.opensAt,
    closesAt: registration.closesAt,
    capacity: registration.capacity,
    remainingSpots: registration.remainingSpots,
  };
}

/** Solo URLs públicas http(s). Relativas / privadas → omitidas (PhotoFrame fallback). */
export function toPublicHttpUrl(url: string | null | undefined): string | undefined {
  if (!url?.trim()) return undefined;
  const value = url.trim();
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return value;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function requireIsoFallback(
  primary: string | null | undefined,
  ...fallbacks: Array<string | null | undefined>
): string {
  for (const candidate of [primary, ...fallbacks]) {
    if (!candidate) continue;
    const date = new Date(candidate);
    if (!Number.isNaN(date.getTime())) return candidate;
  }
  // Último recurso estructural (no editorial): epoch ISO estable.
  return "1970-01-01T00:00:00.000Z";
}

export function mapFotorankCapabilitiesToClickaton(
  marathonId: string,
  capabilities: FotorankPublicCapabilitiesV1,
  evaluatedAt = new Date().toISOString(),
): PublicMarathonCapabilities {
  return {
    marathonId,
    canRegister: capabilities.canRegister,
    canViewRules: capabilities.canViewRules,
    canViewChallenges: false,
    canUploadPhotos: false,
    canViewResults: capabilities.canViewResults,
    canViewGallery: capabilities.canViewGallery,
    canBuyWinningPhotos: false,
    canJoinWaitlist: false,
    canDownloadCertificate: false,
    canCheckIn: false,
    evaluatedAt,
  };
}

function mapOrganizer(
  organization: FotorankPublicEventV1["organization"] | FotorankPublicEventListItemV1["organization"],
): PublicOrganizer {
  return {
    name: organization.name,
    type: "other",
    description:
      "shortDescription" in organization
        ? (organization.shortDescription ?? undefined)
        : undefined,
    logo: toPublicHttpUrl(
      "logoUrl" in organization ? organization.logoUrl : null,
    ),
    website:
      "website" in organization ? (organization.website ?? undefined) : undefined,
    city: "city" in organization ? (organization.city ?? undefined) : undefined,
    country:
      "country" in organization ? (organization.country ?? undefined) : undefined,
  };
}

function mapCategories(
  categories: FotorankPublicEventV1["categories"],
  canView: boolean,
): PublicCategory[] {
  if (!canView) return [];
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description ?? "",
    allowedDevices: [],
  }));
}

function mapJury(
  jury: FotorankPublicJuryMemberV1[],
  canView: boolean,
): PublicJuryMember[] {
  if (!canView) return [];
  return jury.map((member) => ({
    id: member.publicSlug,
    name: member.displayName || `${member.firstName} ${member.lastName}`.trim(),
    role:
      member.categories.length > 0
        ? `Jurado · ${member.categories.join(", ")}`
        : "Jurado",
    biography: member.shortBio ?? undefined,
    portrait: toPublicHttpUrl(member.avatarUrl),
  }));
}

function mapRules(
  rules: FotorankPublicEventV1["rules"],
  canView: boolean,
): PublicRulesDocument | undefined {
  if (!canView || !rules) return undefined;
  return {
    title: rules.title,
    summary: rules.summary ?? "",
    version: "v1",
    content: rules.content ?? undefined,
  };
}

function mapPrizesFromSummary(summary: string | null): PublicPrize[] {
  if (!summary?.trim()) return [];
  return [
    {
      id: "prizes-summary",
      title: "Premios",
      description: summary.trim(),
    },
  ];
}

function mapSponsorsFromText(text: string | null): PublicSponsor[] {
  if (!text?.trim()) return [];
  return [
    {
      id: "sponsors-summary",
      name: text.trim(),
      localOrGlobal: "global",
    },
  ];
}

function mapScheduleItems(event: FotorankPublicEventV1): PublicScheduleItem[] {
  const items: PublicScheduleItem[] = [];
  const { schedule, id } = event;

  if (schedule.startAt) {
    items.push({
      id: `${id}-start`,
      title: "Inicio",
      startAt: schedule.startAt,
      type: "start",
      publicBeforeEvent: true,
    });
  }
  if (schedule.submissionDeadline) {
    items.push({
      id: `${id}-deadline`,
      title: "Cierre de entrega",
      startAt: schedule.submissionDeadline,
      type: "deadline",
      publicBeforeEvent: true,
    });
  }
  if (schedule.judgingStartAt) {
    items.push({
      id: `${id}-judging-start`,
      title: "Inicio de evaluación",
      startAt: schedule.judgingStartAt,
      endAt: schedule.judgingEndAt ?? undefined,
      type: "other",
      publicBeforeEvent: true,
    });
  }
  if (schedule.resultsAt) {
    items.push({
      id: `${id}-results`,
      title: "Resultados",
      startAt: schedule.resultsAt,
      type: "ceremony",
      publicBeforeEvent: true,
    });
  }
  return items;
}

/**
 * Detalle completo V1 → ficha estructural Clickaton.
 */
export function mapFotorankEventToPublicMarathon(
  event: FotorankPublicEventV1,
  options?: { now?: Date },
): PublicMarathon {
  const now = options?.now;
  const status = mapFotorankStatusToMarathonStatus({
    status: event.status,
    registrationStatus: event.registrationStatus,
    resultsStatus: event.resultsStatus,
    schedule: event.schedule,
    now,
  });

  const startAt = requireIsoFallback(
    event.schedule.startAt,
    event.createdAt,
    event.updatedAt,
  );
  const endAt = requireIsoFallback(
    event.schedule.submissionDeadline,
    event.schedule.resultsAt,
    event.schedule.judgingEndAt,
    startAt,
  );

  const socialLinks = event.organization.instagram
    ? { instagram: event.organization.instagram }
    : undefined;

  return {
    id: event.id,
    slug: event.slug,
    name: event.name,
    editionName: event.name,
    shortDescription: event.shortDescription ?? "",
    fullDescription: event.fullDescription ?? "",
    status,
    registrationStatus: mapFotorankRegistrationStatus(event.registrationStatus),
    format: "individual",
    modality:
      event.experienceType === "marathon"
        ? "Maratón fotográfica"
        : "Concurso fotográfico",
    featured: event.featured,
    city: event.territory.city ?? "",
    provinceOrRegion: event.territory.provinceOrRegion ?? "",
    country: event.territory.country ?? "",
    timezone: event.schedule.timezone || "UTC",
    startAt,
    endAt,
    registrationOpenAt: event.registration?.opensAt ?? undefined,
    registrationCloseAt:
      event.registration?.closesAt ??
      event.schedule.submissionDeadline ??
      undefined,
    participantLimit: event.registration?.capacity ?? undefined,
    registration: mapRegistration(event.registration),
    allowedDevices: [],
    coverImage: toPublicHttpUrl(event.coverImageUrl),
    galleryPreview: [],
    organizer: mapOrganizer(event.organization),
    categories: mapCategories(event.categories, event.capabilities.canViewCategories),
    schedule: mapScheduleItems(event),
    prizes: mapPrizesFromSummary(event.prizesSummary),
    jury: mapJury(event.jury, event.capabilities.canViewJury),
    sponsors: mapSponsorsFromText(event.sponsorsText),
    faq: [],
    rules: mapRules(event.rules, event.capabilities.canViewRules),
    socialLinks,
    resultsStatus: mapFotorankResultsStatus(event.resultsStatus),
    galleryStatus: mapFotorankGalleryStatus(event.capabilities),
    challenges: [],
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

/**
 * Ítem de listado V1 → PublicMarathon reducido (apto para MarathonCard).
 */
export function mapFotorankEventListItemToPublicMarathon(
  item: FotorankPublicEventListItemV1,
  options?: { now?: Date },
): PublicMarathon {
  const now = options?.now;
  const status = mapFotorankStatusToMarathonStatus({
    status: item.status,
    registrationStatus: item.registrationStatus,
    resultsStatus: item.resultsStatus,
    schedule: {
      startAt: item.startAt,
      submissionDeadline: item.submissionDeadline,
      judgingStartAt: null,
      judgingEndAt: null,
    },
    now,
  });

  const startAt = requireIsoFallback(item.startAt, item.updatedAt);
  const endAt = requireIsoFallback(item.submissionDeadline, startAt);

  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    editionName: item.name,
    shortDescription: item.shortDescription ?? "",
    fullDescription: "",
    status,
    registrationStatus: mapFotorankRegistrationStatus(item.registrationStatus),
    format: "individual",
    modality:
      item.experienceType === "marathon"
        ? "Maratón fotográfica"
        : "Concurso fotográfico",
    featured: item.featured,
    city: item.territory.city ?? "",
    provinceOrRegion: item.territory.provinceOrRegion ?? "",
    country: item.territory.country ?? "",
    timezone: "UTC",
    startAt,
    endAt,
    registrationOpenAt: item.registration?.opensAt ?? undefined,
    registrationCloseAt:
      item.registration?.closesAt ?? item.submissionDeadline ?? undefined,
    participantLimit: item.registration?.capacity ?? undefined,
    registration: mapRegistration(item.registration),
    allowedDevices: [],
    coverImage: toPublicHttpUrl(item.coverImageUrl),
    galleryPreview: [],
    organizer: mapOrganizer(item.organization),
    categories: [],
    schedule: [],
    prizes: [],
    jury: [],
    sponsors: [],
    faq: [],
    resultsStatus: mapFotorankResultsStatus(item.resultsStatus),
    galleryStatus: mapFotorankGalleryStatus(item.capabilities),
    challenges: [],
    createdAt: item.updatedAt,
    updatedAt: item.updatedAt,
  };
}
