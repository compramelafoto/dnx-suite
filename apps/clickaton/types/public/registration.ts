/**
 * Contratos públicos Clickaton ↔ FotoRank — inscripción y participante.
 * Etapa 09A operativa: precio visible + handoff. Sin cobros reales.
 */

/** Modalidad económica del evento (explícita; no inferir por precio). */
export type RegistrationPricingMode = "free" | "paid";

/**
 * Precio público. amountMinor = unidades mínimas enteras.
 * formatted es solo presentación.
 */
export type PublicDisplayPrice = {
  amountMinor: number;
  currency: string;
  formatted: string;
};

export type PublicRegistrationWindowStatus =
  | "not_open"
  | "open"
  | "closed"
  | "full"
  | "cancelled"
  | "finished"
  | "unknown"
  | string;

/**
 * Bloque público mínimo que Clickatón consume desde la Public API.
 */
export type PublicRegistrationSummary = {
  mode: RegistrationPricingMode;
  status: PublicRegistrationWindowStatus;
  canRegister: boolean;
  displayPrice: PublicDisplayPrice | null;
  hasOptionalMerchandise: boolean;
  registrationUrl: string | null;
  checkoutUrl: string | null;
  opensAt: string | null;
  closesAt: string | null;
  capacity: number | null;
  remainingSpots: number | null;
};

export type RegistrationOfferMode =
  | "unavailable"
  | "coming_soon"
  | "open"
  | "waitlist"
  | "closed"
  | "external";

/**
 * Oferta pública de inscripción para construir el bloque de CTA/caja.
 */
export type PublicRegistrationOffer = {
  marathonId: string;
  enabled: boolean;
  mode: RegistrationOfferMode;
  label: string;
  description?: string;
  requiresAuthentication: boolean;
  /** @deprecated Preferir `pricingMode === "paid"`. */
  requiresPayment: boolean;
  pricingMode: RegistrationPricingMode;
  currency?: string;
  basePrice?: number | null;
  promotionalPrice?: number | null;
  promotionStartsAt?: string | null;
  promotionEndsAt?: string | null;
  displayPrice?: PublicDisplayPrice | null;
  taxesIncluded?: boolean;
  includes?: string[];
  paymentDeadlineAt?: string | null;
  cancellationPolicySummary?: string | null;
  hasOptionalMerchandise: boolean;
  checkoutUrl?: string | null;
  /** @deprecated Preferir `checkoutUrl` / summary.registrationUrl. */
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
  | "payment_pending"
  | "payment_failed"
  | "other";

export type EligibilityBlockedReason = {
  code: EligibilityBlockedReasonCode;
  message: string;
};

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

export type ParticipantRegistrationStatus =
  | "draft"
  | "pending_payment"
  | "confirmed"
  | "cancelled"
  | "expired"
  | "waitlisted";

export type RegistrationPaymentStatus =
  | "not_required"
  | "pending"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "expired"
  | "paid"
  | "failed";

export type AccreditationStatus =
  | "not_started"
  | "pending"
  | "checked_in"
  | "no_show"
  | "cancelled";


export type ParticipantRegistrationSummary = {
  registrationId: string;
  marathonId: string;
  participantName: string;
  teamName?: string;
  categoryId: string;
  categoryName: string;
  registrationStatus: ParticipantRegistrationStatus;
  paymentStatus: RegistrationPaymentStatus;
  accreditationStatus: AccreditationStatus;
  qrAvailable: boolean;
  hasMerchandiseOrder?: boolean;
  createdAt: string;
  updatedAt?: string;
};
