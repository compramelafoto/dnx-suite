import {
  FOTORANK_PUBLIC_CONTRACT_VERSION,
  type FotorankPublicCapabilitiesV1,
  type FotorankPublicCategoryV1,
  type FotorankPublicEventListItemV1,
  type FotorankPublicEventV1,
  type FotorankPublicJuryMemberV1,
  type FotorankPublicOrganizationV1,
  type FotorankPublicRulesV1,
} from "./contracts";
import { FotorankPublicSerializationError } from "./errors";
import {
  deriveRegistrationStatus,
  deriveResultsStatus,
  mapInternalStatusToPublic,
  toIsoOrNull,
  type InternalContestStatus,
} from "./status";
import {
  assertCanSerializeForPublicDetail,
  assertCanSerializeForPublicList,
  type InternalContestVisibility,
} from "./visibility";

/** Shape mínimo interno para serializar (desacoplado de Prisma client types). */
export type PublicEventSerializeSource = {
  id: string;
  slug: string;
  title: string;
  shortDescription: string | null;
  fullDescription: string | null;
  coverImageUrl: string | null;
  rulesText: string | null;
  prizesSummary: string | null;
  sponsorsText: string | null;
  /** Nunca se serializa al contrato público. */
  rulesData?: unknown;
  startAt: Date | null;
  submissionDeadline: Date | null;
  judgingStartAt: Date | null;
  judgingEndAt: Date | null;
  resultsAt: Date | null;
  status: InternalContestStatus;
  visibility: InternalContestVisibility;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string | null;
    logoUrl: string | null;
    website: string | null;
    city: string | null;
    country: string | null;
    instagram: string | null;
    /** Campos internos — se descartan. */
    contactEmail?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    address?: string | null;
    description?: string | null;
    coverImageUrl?: string | null;
  };
  categories: Array<{
    id: string;
    name: string;
    slug: string;
    description: string | null;
    maxFiles: number;
    status?: string;
  }>;
  judges: Array<{
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    publicSlug: string;
    shortBio: string | null;
    categories: string[];
    /** Si llega false, se omite. */
    isPublic?: boolean;
  }>;
};

function buildCapabilities(input: {
  rules: FotorankPublicRulesV1 | null;
  juryCount: number;
  categoryCount: number;
}): FotorankPublicCapabilitiesV1 {
  return {
    canViewRules: Boolean(input.rules?.content || input.rules?.summary),
    canViewJury: input.juryCount > 0,
    canViewCategories: input.categoryCount > 0,
    canRegister: false,
    canViewResults: false,
    canViewGallery: false,
  };
}

export function serializePublicOrganizationV1(
  org: PublicEventSerializeSource["organization"],
): FotorankPublicOrganizationV1 {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    shortDescription: org.shortDescription,
    logoUrl: org.logoUrl,
    website: org.website,
    city: org.city,
    country: org.country,
    instagram: org.instagram,
  };
}

export function serializePublicCategoriesV1(
  categories: PublicEventSerializeSource["categories"],
): FotorankPublicCategoryV1[] {
  return categories
    .filter((c) => !c.status || c.status === "ACTIVE")
    .map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      maxFiles: c.maxFiles,
    }));
}

export function serializePublicJuryV1(
  judges: PublicEventSerializeSource["judges"],
): FotorankPublicJuryMemberV1[] {
  return judges
    .filter((j) => j.isPublic !== false && Boolean(j.publicSlug?.trim()))
    .map((j) => ({
      publicSlug: j.publicSlug,
      firstName: j.firstName,
      lastName: j.lastName,
      displayName: `${j.firstName} ${j.lastName}`.trim(),
      avatarUrl: j.avatarUrl,
      shortBio: j.shortBio,
      categories: [...new Set(j.categories.filter(Boolean))],
    }));
}

export function serializePublicRulesV1(
  rulesText: string | null,
): FotorankPublicRulesV1 | null {
  const content = rulesText?.trim() ? rulesText.trim() : null;
  if (!content) return null;
  return {
    title: "Bases",
    summary: content.length > 280 ? `${content.slice(0, 277)}...` : content,
    content,
  };
}

/**
 * Serializa ficha pública V1.
 * Lanza si el evento no es routable públicamente.
 * Nunca incluye rulesData ni PII de contacto.
 */
export function serializePublicEventV1(
  source: PublicEventSerializeSource,
  options?: { now?: Date; enforceVisibility?: boolean },
): FotorankPublicEventV1 {
  const enforce = options?.enforceVisibility !== false;
  if (
    enforce &&
    !assertCanSerializeForPublicDetail({
      visibility: source.visibility,
      status: source.status,
    })
  ) {
    throw new FotorankPublicSerializationError(
      "NOT_PUBLIC",
      `Event "${source.slug}" is not publicly routable`,
    );
  }

  if (!source.id || !source.slug?.trim() || !source.title?.trim()) {
    throw new FotorankPublicSerializationError(
      "INVALID_PAYLOAD",
      "Public event requires id, slug and title",
    );
  }

  // Guardrail: rulesData no debe filtrarse al contrato (ni siquiera como unknown).
  void source.rulesData;

  const now = options?.now ?? new Date();
  const status = mapInternalStatusToPublic(source.status);
  const categories = serializePublicCategoriesV1(source.categories);
  const jury = serializePublicJuryV1(source.judges);
  const rules = serializePublicRulesV1(source.rulesText);
  const registrationStatus = deriveRegistrationStatus({
    now,
    startAt: source.startAt,
    submissionDeadline: source.submissionDeadline,
    eventStatus: status,
  });
  const resultsStatus = deriveResultsStatus({ now, resultsAt: source.resultsAt });
  const organization = serializePublicOrganizationV1(source.organization);

  return {
    contractVersion: FOTORANK_PUBLIC_CONTRACT_VERSION,
    id: source.id,
    slug: source.slug,
    name: source.title,
    shortDescription: source.shortDescription,
    fullDescription: source.fullDescription,
    eventType: "contest",
    status,
    registrationStatus,
    featured: false,
    organization,
    territory: {
      city: organization.city,
      country: organization.country,
      provinceOrRegion: null,
    },
    schedule: {
      startAt: toIsoOrNull(source.startAt),
      submissionDeadline: toIsoOrNull(source.submissionDeadline),
      judgingStartAt: toIsoOrNull(source.judgingStartAt),
      judgingEndAt: toIsoOrNull(source.judgingEndAt),
      resultsAt: toIsoOrNull(source.resultsAt),
      timezone: null,
    },
    coverImageUrl: source.coverImageUrl,
    categories,
    jury,
    rules,
    prizesSummary: source.prizesSummary?.trim() ? source.prizesSummary.trim() : null,
    sponsorsText: source.sponsorsText?.trim() ? source.sponsorsText.trim() : null,
    resultsStatus,
    capabilities: buildCapabilities({
      rules,
      juryCount: jury.length,
      categoryCount: categories.length,
    }),
    createdAt: source.createdAt.toISOString(),
    updatedAt: source.updatedAt.toISOString(),
  };
}

export function serializePublicEventListItemV1(
  source: PublicEventSerializeSource,
  options?: { now?: Date; enforceVisibility?: boolean; juryPublished?: boolean },
): FotorankPublicEventListItemV1 {
  const enforce = options?.enforceVisibility !== false;
  if (
    enforce &&
    !assertCanSerializeForPublicList({
      visibility: source.visibility,
      status: source.status,
    })
  ) {
    throw new FotorankPublicSerializationError(
      "NOT_PUBLIC",
      `Event "${source.slug}" is not publicly listable`,
    );
  }

  const detail = serializePublicEventV1(source, {
    now: options?.now,
    enforceVisibility: false,
  });

  const juryPublished =
    options?.juryPublished ?? detail.jury.length > 0;

  return {
    contractVersion: FOTORANK_PUBLIC_CONTRACT_VERSION,
    id: detail.id,
    slug: detail.slug,
    name: detail.name,
    shortDescription: detail.shortDescription,
    eventType: detail.eventType,
    status: detail.status,
    registrationStatus: detail.registrationStatus,
    featured: detail.featured,
    organization: {
      id: detail.organization.id,
      name: detail.organization.name,
      slug: detail.organization.slug,
      logoUrl: detail.organization.logoUrl,
    },
    territory: detail.territory,
    startAt: detail.schedule.startAt,
    submissionDeadline: detail.schedule.submissionDeadline,
    coverImageUrl: detail.coverImageUrl,
    categoryCount: detail.categories.length,
    juryPublished,
    resultsStatus: detail.resultsStatus,
    capabilities: detail.capabilities,
    updatedAt: detail.updatedAt,
  };
}
