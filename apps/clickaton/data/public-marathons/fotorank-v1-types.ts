/**
 * Espejo tipado del contrato HTTP FotoRank Public API V1.
 * No importa apps/fotorank (evita Prisma y acoplamiento de build).
 * Fuente de verdad: apps/fotorank/app/lib/public-api/v1/contracts.ts
 *
 * Etapa 08D: sin discriminador de canal/marca (pendiente).
 */

export type FotorankPublicContractVersion = "v1";

export type FotorankPublicEventTypeV1 = "contest";

export type FotorankPublicEventStatusV1 =
  | "draft"
  | "published"
  | "closed"
  | "archived";

export type FotorankPublicRegistrationStatusV1 =
  | "not_open"
  | "open"
  | "closed"
  | "unknown";

export type FotorankPublicResultsStatusV1 =
  | "not_available"
  | "scheduled"
  | "pending_publication"
  | "published";

export type FotorankPublicCapabilitiesV1 = {
  canViewRules: boolean;
  canViewJury: boolean;
  canViewCategories: boolean;
  canRegister: boolean;
  canViewResults: boolean;
  canViewGallery: boolean;
};

export type FotorankPublicOrganizationV1 = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  logoUrl: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  instagram: string | null;
};

export type FotorankPublicCategoryV1 = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  maxFiles: number;
};

export type FotorankPublicJuryMemberV1 = {
  publicSlug: string;
  firstName: string;
  lastName: string;
  displayName: string;
  avatarUrl: string | null;
  shortBio: string | null;
  categories: string[];
};

export type FotorankPublicRulesV1 = {
  title: string;
  summary: string | null;
  content: string | null;
};

export type FotorankPublicTerritoryV1 = {
  city: string | null;
  country: string | null;
  provinceOrRegion: string | null;
};

export type FotorankPublicScheduleDatesV1 = {
  startAt: string | null;
  submissionDeadline: string | null;
  judgingStartAt: string | null;
  judgingEndAt: string | null;
  resultsAt: string | null;
  timezone: string | null;
};

export type FotorankPublicEventListItemV1 = {
  contractVersion: FotorankPublicContractVersion;
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  eventType: FotorankPublicEventTypeV1;
  status: FotorankPublicEventStatusV1;
  registrationStatus: FotorankPublicRegistrationStatusV1;
  featured: boolean;
  organization: Pick<
    FotorankPublicOrganizationV1,
    "id" | "name" | "slug" | "logoUrl"
  >;
  territory: FotorankPublicTerritoryV1;
  startAt: string | null;
  submissionDeadline: string | null;
  coverImageUrl: string | null;
  categoryCount: number;
  juryPublished: boolean;
  resultsStatus: FotorankPublicResultsStatusV1;
  capabilities: FotorankPublicCapabilitiesV1;
  updatedAt: string;
};

export type FotorankPublicEventV1 = {
  contractVersion: FotorankPublicContractVersion;
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  eventType: FotorankPublicEventTypeV1;
  status: FotorankPublicEventStatusV1;
  registrationStatus: FotorankPublicRegistrationStatusV1;
  featured: boolean;
  organization: FotorankPublicOrganizationV1;
  territory: FotorankPublicTerritoryV1;
  schedule: FotorankPublicScheduleDatesV1;
  coverImageUrl: string | null;
  categories: FotorankPublicCategoryV1[];
  jury: FotorankPublicJuryMemberV1[];
  rules: FotorankPublicRulesV1 | null;
  prizesSummary: string | null;
  sponsorsText: string | null;
  resultsStatus: FotorankPublicResultsStatusV1;
  capabilities: FotorankPublicCapabilitiesV1;
  createdAt: string;
  updatedAt: string;
};

export type FotorankPublicEventsListEnvelopeV1 = {
  version: FotorankPublicContractVersion;
  data: { items: FotorankPublicEventListItemV1[] };
  meta: { count: number };
};

export type FotorankPublicEventDetailEnvelopeV1 = {
  version: FotorankPublicContractVersion;
  data: { event: FotorankPublicEventV1 };
};

export type FotorankPublicErrorEnvelopeV1 = {
  version: FotorankPublicContractVersion;
  error: {
    code: "INVALID_REQUEST" | "EVENT_NOT_FOUND" | "INTERNAL_ERROR" | string;
    message: string;
  };
};
