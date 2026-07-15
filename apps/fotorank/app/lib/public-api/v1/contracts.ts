/**
 * FotoRank Public API — contratos V1 (serialización servidor).
 * Independientes de Clickaton y de modelos Prisma.
 * Versionado conceptual: "v1" (futuros Route Handlers: /api/public/v1/...).
 */

export const FOTORANK_PUBLIC_CONTRACT_VERSION = "v1" as const;

export type PublicContractVersion = typeof FOTORANK_PUBLIC_CONTRACT_VERSION;

/** Tipo de competencia pública. Hoy solo contest; maratón/rally llegan después. */
export type FotorankPublicEventTypeV1 = "contest";

/**
 * Ciclo de vida público (no copia enums internos Prisma).
 * ACTIVE legacy se normaliza a published.
 */
export type FotorankPublicEventStatusV1 =
  | "draft"
  | "published"
  | "closed"
  | "archived";

/**
 * Inscripción pública derivada de fechas existentes.
 * No implica que exista flujo de alta de participante.
 */
export type FotorankPublicRegistrationStatusV1 =
  | "not_open"
  | "open"
  | "closed"
  | "unknown";

/** Resultados públicos (sin payload de ranking en V1). */
export type FotorankPublicResultsStatusV1 =
  | "not_available"
  | "scheduled"
  | "pending_publication"
  | "published";

export type FotorankPublicCapabilitiesV1 = {
  canViewRules: boolean;
  canViewJury: boolean;
  canViewCategories: boolean;
  /** Siempre false hasta existir inscripción pública. */
  canRegister: boolean;
  /** Siempre false hasta existir API/payload de resultados públicos. */
  canViewResults: boolean;
  /** Siempre false hasta existir galería pública de evento. */
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
  /** Límite de archivos por obra (no es cupo de participantes). */
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
  /** Texto público de bases. Nunca incluye rulesData JSON interno. */
  content: string | null;
};

export type FotorankPublicTerritoryV1 = {
  city: string | null;
  country: string | null;
  /** Provincia/región: aún no modelada en contest. */
  provinceOrRegion: string | null;
};

export type FotorankPublicScheduleDatesV1 = {
  startAt: string | null;
  /** No existe endAt nativo; se usa submissionDeadline como cierre operativo visible. */
  submissionDeadline: string | null;
  judgingStartAt: string | null;
  judgingEndAt: string | null;
  resultsAt: string | null;
  /** Timezone IANA: aún no existe en Prisma. */
  timezone: string | null;
};

export type FotorankPublicEventListItemV1 = {
  contractVersion: PublicContractVersion;
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  eventType: FotorankPublicEventTypeV1;
  status: FotorankPublicEventStatusV1;
  registrationStatus: FotorankPublicRegistrationStatusV1;
  featured: boolean;
  organization: Pick<FotorankPublicOrganizationV1, "id" | "name" | "slug" | "logoUrl">;
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
  contractVersion: PublicContractVersion;
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
  /** Resumen textual público; no estructura económica interna. */
  prizesSummary: string | null;
  /** Texto libre de sponsors; no objetos tipados hasta existir modelo. */
  sponsorsText: string | null;
  resultsStatus: FotorankPublicResultsStatusV1;
  capabilities: FotorankPublicCapabilitiesV1;
  createdAt: string;
  updatedAt: string;
};
