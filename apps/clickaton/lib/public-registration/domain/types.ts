import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";

export type PublicEditionDto = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  status: string;
  isPublished: boolean;
  registrationEnabled: boolean;
  registrationOpenAt: Date | null;
  registrationCloseAt: Date | null;
  startAt: Date | null;
  endAt: Date | null;
  timezone: string | null;
  currency?: string;
};

export type PublicVenueDto = {
  id: string;
  name: string;
  city: string | null;
  province: string | null;
  address: string | null;
  startAt: Date | null;
  isActive: boolean;
};

export type PublicTicketProductDto = {
  /** Presente si el ítem proviene del ticket base. */
  ticketTypeItemId: string | null;
  /** Presente si el ítem proviene de la fase de precio. */
  pricePhaseItemId?: string | null;
  sourceType?: "TICKET_BASE" | "PRICE_PHASE";
  productId: string;
  productName: string;
  productDescription?: string | null;
  quantity: number;
  requiresVariantChoice: boolean;
  fulfillmentRequired?: boolean;
  primaryImageUrl?: string | null;
  sizeChartUrl?: string | null;
  sizeChartDescription?: string | null;
  sizeChartInstructions?: string | null;
  gallery?: Array<{
    url: string | null;
    altText: string | null;
    caption: string | null;
    sortOrder: number;
  }>;
  fixedVariant: {
    id: string;
    name: string;
    sku: string;
  } | null;
  variants: Array<{
    id: string;
    code?: string;
    name: string;
    sku: string;
    availableStock: number;
    isActive: boolean;
    sortOrder?: number;
  }>;
};

export type PublicTicketDto = {
  id: string;
  name: string;
  description: string | null;
  code: string;
  priceAmount: number;
  currency: string;
  capacity: number | null;
  available: number | null;
  isUnlimited: boolean;
  isSoldOut: boolean;
  holdMinutes: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  salesStatus: "open" | "not_started" | "ended" | "inactive";
  venueId: string | null;
  kitKind: "entry" | "entry_product" | "kit";
  products: PublicTicketProductDto[];
  /** Pack 4 maratones ($100.000 / 4 créditos / 2 años). */
  isMarathonPack?: boolean;
};

export type PublicPricePhaseSummaryDto = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  startsAt: Date;
  endsAt: Date;
  includedProductCount: number;
  includesPhysicalMerch: boolean;
  /** Oferta first-N+deadline vigente para mostrar/seleccionar remera. */
  shirtBenefitAvailable?: boolean;
  /** Había merch en fase pero cupo/deadline agotaron la oferta. */
  shirtBenefitEnded?: boolean;
};

export type PublicNextPricePhaseDto = {
  id: string;
  name: string;
  amount: number;
  currency: string;
  startsAt: Date;
};

export type PublicPassCreditsDto = {
  entitlementId: string;
  remaining: number;
  expiresAt: string | null;
};

export type PublicRegistrationContextDto = {
  edition: PublicEditionDto;
  venues: PublicVenueDto[];
  tickets: PublicTicketDto[];
  /** Fase vigente resuelta en backend (null si no hay fases activas). */
  currentPricePhase: PublicPricePhaseSummaryDto | null;
  /**
   * Próxima fase activa futura (si existe). Solo presentación:
   * permite mostrar el precio siguiente tachado cuando es mayor.
   */
  nextPricePhase: PublicNextPricePhaseDto | null;
  registrationWindow: "open" | "not_open" | "closed" | "unavailable";
  /** Créditos de Pack 4 disponibles (si el email/sesión tiene pass activo). */
  passCredits: PublicPassCreditsDto | null;
  legal: {
    termsPath: string;
    privacyPath: string;
    rulesAnchor: string;
  };
};

export type PublicParticipantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  documentNumber?: string;
  city?: string;
  province?: string;
  country?: string;
  birthDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
};

export type CreatePublicRegistrationInput = {
  editionSlug: string;
  venueId: string | null;
  ticketTypeId: string;
  variantChoices: Array<{ productId: string; productVariantId: string }>;
  participant: PublicParticipantInput;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptImage: boolean;
  instagramHandle?: string;
  profilePhotoAssetId?: string;
  imageUsageConsent?: boolean;
  socialPublicationConsent?: boolean;
  identifiablePersonsConsent?: boolean;
  promotionalLicenseConsent?: boolean;
  consentVersion?: string;
  termsVersion?: string;
  idempotencyKey: string;
  /** Código promocional opcional (normalizado en backend). */
  promoCode?: string | null;
  /** Canjear 1 crédito del Pack 4 (inscripción sin cargo). */
  usePassCredit?: boolean;
  passEntitlementId?: string | null;
};

export type PublicRegistrationSummaryDto = {
  /** ID interno — solo con accessToken válido. */
  registrationId: string;
  publicCode: string | null;
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  /** true si holdExpiresAt venció o status ya materializó expiración. */
  isExpired: boolean;
  reservationActive: boolean;
  editionName: string;
  editionSlug: string;
  venueName: string | null;
  ticketName: string;
  /** PII enmascarada para superficie pública. */
  participant: {
    firstName: string;
    lastNameInitial: string;
    emailMasked: string;
    phoneMasked: string;
    documentMasked: string;
  };
  /** Precio antes de descuento (minor units). */
  subtotalAmount: number;
  /** Descuento aplicado (minor units). */
  discountAmount: number;
  totalAmount: number;
  currency: string;
  items: Array<{
    nameSnapshot: string;
    variantNameSnapshot?: string | null;
    skuSnapshot: string | null;
    quantity: number;
    isIncluded?: boolean;
  }>;
  holdExpiresAt: Date | null;
  accessToken: string;
  nextStepMessage: string;
  checkoutEligible: boolean;
};

export type ExpirePendingBatchResult = {
  scanned: number;
  expired: number;
  skipped: number;
  failed: number;
  releasedCapacityHolds: number;
  releasedStockHolds: number;
  errors: Array<{ registrationId: string; code: string }>;
  dryRun: boolean;
};

export type CheckoutEligibilityDto = {
  eligible: boolean;
  reason: string | null;
  registrationStatus: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  expiresAt: Date | null;
  amountMinor: number;
  currency: string;
  editionId: string;
  ticketTypeId: string;
  publicCode: string | null;
};

export type PublicRegistrationOffer = {
  available: boolean;
  href: string | null;
  label: string | null;
  reason:
    | "ok"
    | "edition_unavailable"
    | "no_tickets"
    | "window_closed"
    | "window_not_open"
    | "sold_out"
    | "db_unavailable";
};
