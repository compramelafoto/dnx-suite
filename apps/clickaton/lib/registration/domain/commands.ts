import type {
  ClickatonCheckInSource,
  ClickatonKitDeliveryStatus,
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
  ParticipantSnapshot,
  TicketSelection,
} from "./types";

export type CreateDraftRegistrationCommand = {
  editionId: string;
  userId: number;
  ticket: TicketSelection;
  participant: ParticipantSnapshot;
  /** Minor units congelados al crear el draft. */
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  /** Snapshot fase de precio (opcional; null si ticket gratis o sin fases). */
  pricePhaseId?: string | null;
  pricePhaseNameSnapshot?: string | null;
  pricePhaseAmountSnapshot?: number | null;
  /** Snapshot promoción (@repo/promotions). */
  promotionId?: string | null;
  promotionCodeSnapshot?: string | null;
  instagramHandle?: string | null;
  instagramHandleNormalized?: string | null;
  instagramUrl?: string | null;
  profilePhotoAssetId?: string | null;
  imageUsageConsent?: boolean;
  socialPublicationConsent?: boolean;
  consentAcceptedAt?: Date | null;
  consentVersion?: string | null;
  holdMinutes?: number;
  items: Array<{
    ticketTypeItemId?: string | null;
    pricePhaseItemId?: string | null;
    sourceType?: "TICKET_BASE" | "PRICE_PHASE" | "STORE_PURCHASE";
    productId?: string | null;
    productVariantId?: string | null;
    nameSnapshot: string;
    productNameSnapshot?: string | null;
    productDescriptionSnapshot?: string | null;
    variantNameSnapshot?: string | null;
    skuSnapshot?: string | null;
    quantity: number;
    unitPriceAmount: number;
    totalPriceAmount: number;
    currency: string;
    isIncluded: boolean;
    imageAssetIdSnapshot?: string | null;
    sizeChartAssetIdSnapshot?: string | null;
  }>;
};

export type ConfirmRegistrationCommand = {
  registrationId: string;
  paymentStatus: ClickatonPaymentStatus;
  /** Si true, asigna visibleCode + sequence vía EditionSequence. */
  assignVisibleCode: boolean;
  editionPrefix: string;
  actorUserId?: number | null;
  source: string;
  requestId?: string | null;
};

export type TransitionRegistrationCommand = {
  registrationId: string;
  newStatus: ClickatonRegistrationStatus;
  newPaymentStatus: ClickatonPaymentStatus;
  actorUserId?: number | null;
  source: string;
  reason?: string | null;
  requestId?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type IssueCredentialCommand = {
  registrationId: string;
  publicCode: string;
};

export type IssueQrTokenCommand = {
  credentialId: string;
  /** Bits de entropía del token (mín. 128). */
  entropyBytes?: number;
};

export type PerformCheckInCommand = {
  registrationId: string;
  credentialId: string;
  venueId?: string | null;
  operatorUserId: number;
  source: ClickatonCheckInSource;
  requestId?: string | null;
};

export type ReverseCheckInCommand = {
  checkInId: string;
  reversedByUserId: number;
  reversalReason: string;
  requestId?: string | null;
};

export type DeliverKitCommand = {
  registrationId: string;
  venueId?: string | null;
  operatorUserId: number;
  status: Exclude<ClickatonKitDeliveryStatus, "REVERSED">;
  requestId?: string | null;
  notes?: string | null;
  items: Array<{
    registrationItemId: string;
    quantityDelivered: number;
    notes?: string | null;
  }>;
};

export type ReverseKitDeliveryCommand = {
  deliveryId: string;
  reversedByUserId: number;
  notes?: string | null;
  requestId?: string | null;
};
