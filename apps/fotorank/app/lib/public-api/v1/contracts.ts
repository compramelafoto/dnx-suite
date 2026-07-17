/**
 * FotoRank Public API — contratos V1 (serialización servidor).
 * Independientes de Clickaton y de modelos Prisma.
 * Versionado conceptual: "v1" (futuros Route Handlers: /api/public/v1/...).
 */

export const FOTORANK_PUBLIC_CONTRACT_VERSION = "v1" as const;

export type PublicContractVersion = typeof FOTORANK_PUBLIC_CONTRACT_VERSION;

/**
 * Tipo de experiencia pública (Etapa 09A).
 * Independiente del enum Prisma y del canal de distribución.
 * Reemplaza el literal fijo eventType: "contest".
 */
export type FotorankPublicExperienceTypeV1 = "contest" | "marathon";

/**
 * @deprecated Preferir `FotorankPublicExperienceTypeV1` / campo `experienceType`.
 * Conservado solo como alias de transición en tipos internos.
 */
export type FotorankPublicEventTypeV1 = FotorankPublicExperienceTypeV1;

/**
 * Canal / marca de publicación pública (Etapa 08C).
 * Independiente de visibility. Singular: un evento → un canal.
 * null / ausente = portal general FotoRank (no Clickatón).
 */
export type FotorankPublicDistributionChannelV1 = "fotorank" | "clickaton";

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
 * Inscripción pública derivada de fechas + config (Etapa 09A).
 * Incluye cupo completo / cancelado / finalizado además de open/closed.
 */
export type FotorankPublicRegistrationStatusV1 =
  | "not_open"
  | "open"
  | "closed"
  | "full"
  | "cancelled"
  | "finished"
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

/**
 * Modalidad económica explícita (Etapa 09A).
 * No inferir desde precio. Independiente de visibility / distributionChannel / status.
 */
export type FotorankPublicRegistrationPricingModeV1 = "free" | "paid";

/**
 * Precio público. `amountMinor` en unidades mínimas enteras (centavos). Nunca float.
 * `formatted` es solo presentación; la lógica usa amountMinor + currency.
 */
export type FotorankPublicDisplayPriceV1 = {
  amountMinor: number;
  currency: string;
  formatted: string;
};

/**
 * Bloque público de inscripción para Clickatón / consumidores (Etapa 09A).
 * No expone órdenes, collector, stock admin ni liquidación.
 */
export type FotorankPublicRegistrationV1 = {
  /** Modalidad económica (`pricingMode` en el spec; nombre estable: `mode`). */
  mode: FotorankPublicRegistrationPricingModeV1;
  status: FotorankPublicRegistrationStatusV1;
  canRegister: boolean;
  displayPrice: FotorankPublicDisplayPriceV1 | null;
  hasOptionalMerchandise: boolean;
  /** Inicio del flujo público en FotoRank (landing / login). */
  registrationUrl: string | null;
  /** Checkout real (09B). null en 09A. */
  checkoutUrl: string | null;
  opensAt: string | null;
  closesAt: string | null;
  capacity: number | null;
  /** Solo si el cupo es fiable; null si ilimitado o no publicado. */
  remainingSpots: number | null;
};

/**
 * Estados de una inscripción concreta (participante). No son la ventana del evento.
 * Persistencia y transiciones: Etapa 09B.
 */
export type FotorankParticipantRegistrationStatusV1 =
  | "draft"
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "waitlisted";

/**
 * Estados de pago asociados a inscripción/orden.
 * Persistencia, webhook e idempotencia: Etapa 09B. Split: 09C.
 */
export type FotorankRegistrationPaymentStatusV1 =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "expired";

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
  /** Formato de experiencia pública (contest | marathon). Independiente del canal. */
  experienceType: FotorankPublicExperienceTypeV1;
  /** Canal de distribución. null = portal general FotoRank. */
  distributionChannel: FotorankPublicDistributionChannelV1 | null;
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
  /**
   * Resumen de cobro/inscripción (09A+). Opcional hasta serialización estable.
   * Cards Clickatón: Gratis / Desde $X / merch opcional.
   */
  registration?: FotorankPublicRegistrationV1;
  updatedAt: string;
};

export type FotorankPublicEventV1 = {
  contractVersion: PublicContractVersion;
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  fullDescription: string | null;
  /** Formato de experiencia pública (contest | marathon). Independiente del canal. */
  experienceType: FotorankPublicExperienceTypeV1;
  /** Canal de distribución. null = portal general FotoRank. */
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
  /** Resumen textual público; no estructura económica interna. */
  prizesSummary: string | null;
  /** Texto libre de sponsors; no objetos tipados hasta existir modelo. */
  sponsorsText: string | null;
  resultsStatus: FotorankPublicResultsStatusV1;
  capabilities: FotorankPublicCapabilitiesV1;
  /**
   * Resumen de cobro/inscripción (09A+). Opcional hasta serialización estable.
   * No mezclar con `rulesData`/economía interna simulada.
   */
  registration?: FotorankPublicRegistrationV1;
  createdAt: string;
  updatedAt: string;
};
