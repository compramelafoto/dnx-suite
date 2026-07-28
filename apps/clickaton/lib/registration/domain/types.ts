/**
 * Contratos de dominio 10D2 — alineados al schema Prisma Clickatón.
 * Refinan 10D1: pago y check-in/kit desacoplados; TicketTypeItem (no Kit/KitItem).
 */

export type ClickatonRegistrationStatus =
  | "DRAFT"
  | "PENDING_PAYMENT"
  | "CONFIRMED"
  | "WAITLISTED"
  | "CANCELLED"
  | "REFUNDED"
  | "DISQUALIFIED";

export type ClickatonPaymentStatus =
  | "NOT_REQUIRED"
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED"
  | "MANUAL_REVIEW";

export type ClickatonHoldStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "RELEASED";

export type ClickatonCredentialStatus = "ACTIVE" | "REVOKED" | "REPLACED";

export type ClickatonQrTokenStatus = "ACTIVE" | "REVOKED";

export type ClickatonKitDeliveryStatus = "PENDING" | "PARTIAL" | "DELIVERED" | "REVERSED";

export type ClickatonItemFulfillmentStatus =
  | "PENDING"
  | "READY"
  | "DELIVERED"
  | "CANCELLED"
  | "RETURNED";

export type ClickatonCheckInSource = "QR_SCAN" | "MANUAL_SEARCH" | "ADMIN";

/** Snapshot del participante congelado en la inscripción. */
export type ParticipantSnapshot = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  documentNumber?: string | null;
  city?: string | null;
  province?: string | null;
  country: string;
  birthDate?: Date | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  acceptedTermsAt?: Date | null;
  acceptedImageAt?: Date | null;
};

export type TicketSelection = {
  ticketTypeId: string;
  venueId?: string | null;
  /** Variantes elegidas para ítems con requiresVariantChoice. */
  variantChoices?: Array<{ productId: string; productVariantId: string }>;
};

export type RegistrationItemSnapshot = {
  id: string;
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
  fulfillmentStatus?: ClickatonItemFulfillmentStatus;
  fulfilledAt?: Date | null;
  fulfilledByUserId?: number | null;
  fulfillmentNotes?: string | null;
  fulfillmentLocation?: string | null;
};

export type MoneySnapshot = {
  currency: string;
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
};

export type ClickatonRegistrationRecord = {
  id: string;
  editionId: string;
  venueId?: string | null;
  userId: number;
  ticketTypeId: string;
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  visibleCode?: string | null;
  sequenceNumber?: number | null;
  participant: ParticipantSnapshot;
  money: MoneySnapshot;
  holdExpiresAt?: Date | null;
  confirmedAt?: Date | null;
  cancelledAt?: Date | null;
  refundedAt?: Date | null;
  items: RegistrationItemSnapshot[];
  paymentOrderId?: string | null;
  paymentProvider?: string | null;
  paymentExternalReference?: string | null;
  paymentIdempotencyKey?: string | null;
};

/** Representación de emisión: el plaintext solo vive en memoria en el momento de emitir. */
export type QrTokenIssuance = {
  credentialId: string;
  /** Solo para entregar al participante; nunca persistir. */
  plaintextToken: string;
  tokenHash: string;
  tokenPrefix?: string;
  status: ClickatonQrTokenStatus;
};

export type CredentialRecord = {
  id: string;
  registrationId: string;
  status: ClickatonCredentialStatus;
  publicCode: string;
  issuedAt: Date;
  revokedAt?: Date | null;
};

export type CheckInRecord = {
  id: string;
  registrationId: string;
  credentialId: string;
  venueId?: string | null;
  operatorUserId: number;
  checkedInAt: Date;
  reversedAt?: Date | null;
  reversedByUserId?: number | null;
  reversalReason?: string | null;
  source: ClickatonCheckInSource;
  requestId?: string | null;
};

export type KitDeliveryRecord = {
  id: string;
  registrationId: string;
  venueId?: string | null;
  operatorUserId: number;
  status: ClickatonKitDeliveryStatus;
  deliveredAt?: Date | null;
  reversedAt?: Date | null;
  reversedByUserId?: number | null;
  notes?: string | null;
  requestId?: string | null;
  items: Array<{
    registrationItemId: string;
    quantityDelivered: number;
    notes?: string | null;
  }>;
};

export type CapacityHoldRecord = {
  id: string;
  registrationId: string;
  editionId: string;
  venueId?: string | null;
  ticketTypeId: string;
  status: ClickatonHoldStatus;
  expiresAt: Date;
  consumedAt?: Date | null;
  releasedAt?: Date | null;
};

export type StockHoldRecord = {
  id: string;
  registrationId: string;
  productVariantId: string;
  quantity: number;
  status: ClickatonHoldStatus;
  expiresAt: Date;
  consumedAt?: Date | null;
  releasedAt?: Date | null;
};

/**
 * Mapeo 10D1 (estado único con PAYMENT_*) → 10D2 (status + paymentStatus).
 */
export const DESIGN_STATUS_TO_DOMAIN: Record<
  string,
  { status: ClickatonRegistrationStatus; paymentStatus: ClickatonPaymentStatus }
> = {
  DRAFT: { status: "DRAFT", paymentStatus: "NOT_REQUIRED" },
  PENDING_PAYMENT: { status: "PENDING_PAYMENT", paymentStatus: "PENDING" },
  PAYMENT_PROCESSING: { status: "PENDING_PAYMENT", paymentStatus: "PROCESSING" },
  CONFIRMED: { status: "CONFIRMED", paymentStatus: "APPROVED" },
  PAYMENT_FAILED: { status: "PENDING_PAYMENT", paymentStatus: "FAILED" },
  PAYMENT_EXPIRED: { status: "CANCELLED", paymentStatus: "EXPIRED" },
  CANCELLED: { status: "CANCELLED", paymentStatus: "CANCELLED" },
  REFUNDED: { status: "REFUNDED", paymentStatus: "REFUNDED" },
  TRANSFER_PENDING_REVIEW: { status: "PENDING_PAYMENT", paymentStatus: "MANUAL_REVIEW" },
  TRANSFER_REJECTED: { status: "CANCELLED", paymentStatus: "FAILED" },
  WAITLISTED: { status: "WAITLISTED", paymentStatus: "NOT_REQUIRED" },
  DISQUALIFIED: { status: "DISQUALIFIED", paymentStatus: "NOT_REQUIRED" },
};
