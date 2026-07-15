/**
 * Espejo tipado del contrato HTTP FotoRank Public API V1.
 * No importa apps/fotorank (evita Prisma y acoplamiento de build).
 * Fuente de verdad: apps/fotorank/app/lib/public-api/v1/contracts.ts
 *
 * Etapa 09A: experienceType (contest | marathon) + distributionChannel.
 * Clickatón oficial = marathon + clickaton.
 */

export type FotorankPublicContractVersion = "v1";

export type FotorankPublicExperienceTypeV1 = "contest" | "marathon";

/** @deprecated Preferir FotorankPublicExperienceTypeV1 */
export type FotorankPublicEventTypeV1 = FotorankPublicExperienceTypeV1;

export type FotorankPublicDistributionChannelV1 = "fotorank" | "clickaton";

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

export type FotorankPublicRegistrationPricingModeV1 = "free" | "paid";

export type FotorankPublicDisplayPriceV1 = {
  amount: number;
  currency: string;
};

/** Bloque público de inscripción (09A+). Opcional en el payload hasta serialización estable. */
export type FotorankPublicRegistrationV1 = {
  mode: FotorankPublicRegistrationPricingModeV1;
  status: FotorankPublicRegistrationStatusV1;
  canRegister: boolean;
  displayPrice: FotorankPublicDisplayPriceV1 | null;
  hasOptionalMerchandise: boolean;
  checkoutUrl: string | null;
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
  experienceType: FotorankPublicExperienceTypeV1;
  distributionChannel: FotorankPublicDistributionChannelV1 | null;
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
  registration?: FotorankPublicRegistrationV1;
  updatedAt: string;
};

export type FotorankPublicEventV1 = {
  contractVersion: FotorankPublicContractVersion;
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  experienceType: FotorankPublicExperienceTypeV1;
  distributionChannel: FotorankPublicDistributionChannelV1 | null;
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
  registration?: FotorankPublicRegistrationV1;
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
