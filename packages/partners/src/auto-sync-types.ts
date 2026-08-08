/** Eventos canónicos de reevaluación de accesos (Stage 03 Imp 02). */
export const PARTNER_BENEFIT_SYNC_EVENT_TYPES = [
  "CLICKATON_REGISTRATION_CREATED",
  "CLICKATON_REGISTRATION_CONFIRMED",
  "CLICKATON_REGISTRATION_CANCELLED",
  "CLICKATON_REGISTRATION_USER_LINKED",
  "CLICKATON_REGISTRATION_CATEGORY_CHANGED",
  "CLICKATON_PAYMENT_CONFIRMED",
  "CLICKATON_PAYMENT_REVERSED",
  "CLICKATON_WINNER_CONFIRMED",
  "CLICKATON_WINNER_REVOKED",
  "PARTNER_BENEFIT_ACTIVATED",
  "PARTNER_BENEFIT_PAUSED",
  "PARTNER_BENEFIT_ARCHIVED",
  "PARTNER_BENEFIT_AUDIENCE_CHANGED",
  "PARTNER_BENEFIT_VALIDITY_CHANGED",
] as const;

export type PartnerBenefitSyncEventType =
  (typeof PARTNER_BENEFIT_SYNC_EVENT_TYPES)[number];

/** Payload mínimo — solo IDs. */
export type PartnerBenefitSyncEventPayload = {
  eventType: PartnerBenefitSyncEventType;
  occurredAt: string;
  editionId: string;
  registrationId?: string;
  userId?: number;
  benefitId?: string;
  categoryId?: string;
  previousCategoryId?: string;
  prizeAssignmentId?: string;
  prizeBundleId?: string;
  previousWinnerRegistrationId?: string;
  paymentOrderId?: string;
  /** Versión canónica del ganador (audit). */
  winnerVersion?: number;
  /** Versión estable para eventKey (p. ej. ISO updatedAt). */
  versionToken?: string;
};

export type BenefitAudienceScopeHint = {
  benefitId: string;
  audienceKeys: string[];
  categoryIds: string[];
  prizeBundleIds: string[];
  application: string | null;
};

export type AffectedBenefitsResolution = {
  editionId: string;
  benefitIds: string[];
  reason: string;
};
