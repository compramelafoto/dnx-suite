/**
 * Contratos públicos Clickaton ↔ FotoRank — inscripción y participante.
 * Solo tipos. Sin comportamiento, sin fetch, sin Identity/Payments.
 */

export type RegistrationOfferMode =
  | "unavailable"
  | "coming_soon"
  | "open"
  | "waitlist"
  | "closed"
  | "external";

/**
 * Oferta pública de inscripción para construir el bloque de CTA/caja.
 * No calcula precios ni integra Mercado Pago.
 */
export type PublicRegistrationOffer = {
  marathonId: string;
  enabled: boolean;
  mode: RegistrationOfferMode;
  label: string;
  description?: string;
  requiresAuthentication: boolean;
  requiresPayment: boolean;
  currency?: string;
  /** Monto base en unidades menores o decimales según acuerdo futuro; no calcular en Clickaton. */
  basePrice?: number;
  promotionalPrice?: number;
  promotionEndsAt?: string;
  taxesIncluded?: boolean;
  /** URL de inscripción (FotoRank / Identity). Opcional hasta integración. */
  registrationUrl?: string;
  disabledReason?: string;
  updatedAt: string;
};

export type EligibilityBlockedReasonCode =
  | "not_authenticated"
  | "already_registered"
  | "age"
  | "category_full"
  | "event_full"
  | "registration_closed"
  | "geo_restricted"
  | "requirements_pending"
  | "banned"
  | "other";

export type EligibilityBlockedReason = {
  code: EligibilityBlockedReasonCode;
  message: string;
};

/**
 * Elegibilidad dependiente del usuario autenticado.
 * No consultar usuario en esta etapa.
 */
export type RegistrationEligibility = {
  marathonId: string;
  eligible: boolean;
  alreadyRegistered: boolean;
  allowedCategoryIds: string[];
  blockedReasons: EligibilityBlockedReason[];
  pendingRequirements: string[];
  registrationId?: string;
  waitlistAvailable: boolean;
  evaluatedAt: string;
};

export type RegistrationPaymentStatus =
  | "not_required"
  | "pending"
  | "paid"
  | "failed"
  | "refunded"
  | "cancelled";

export type AccreditationStatus =
  | "not_started"
  | "pending"
  | "checked_in"
  | "no_show"
  | "cancelled";

/**
 * Resumen de una inscripción existente (vista “mi inscripción”).
 * No genera QR; solo indica si está disponible.
 */
export type ParticipantRegistrationSummary = {
  registrationId: string;
  marathonId: string;
  participantName: string;
  teamName?: string;
  categoryId: string;
  categoryName: string;
  paymentStatus: RegistrationPaymentStatus;
  accreditationStatus: AccreditationStatus;
  qrAvailable: boolean;
  createdAt: string;
  updatedAt?: string;
};
