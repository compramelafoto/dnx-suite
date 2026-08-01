import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";

/** Estados normalizados DNX Payments (capa comercial, no crudos del proveedor). */
export type DnxNormalizedPaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "CHARGEBACK";

export type CreatePaymentOrderInput = {
  sourceApp: "CLICKATON";
  sourceType: "REGISTRATION" | "STORE_ORDER";
  sourceId: string;
  idempotencyKey: string;
  amountMinor: number;
  currency: "ARS";
  description: string;
  payer?: {
    email?: string;
    firstName?: string;
    lastName?: string;
  };
  successUrl: string;
  pendingUrl: string;
  failureUrl: string;
  webhookContext?: Record<string, string>;
  /** Snapshot financiero v2 + token collector (N=1). Token nunca se persiste. */
  editionFinance?: {
    snapshot: import("@repo/payments/edition-checkout").EditionCheckoutFinanceSnapshot;
    collectorAccessToken?: string;
  };
  /**
   * Card Payment Brick submission (Orders 1:N).
   * Browser amounts are ignored for charging — server reconstructs price.
   */
  cardPayment?: import("@repo/payments/frontend").CardPaymentSubmission;
};

export type CardPaymentCheckoutResultDto = {
  registrationId: string;
  paymentOrderId: string;
  providerOrderId: string | null;
  amountMinor: number;
  currency: "ARS";
  status: DnxNormalizedPaymentStatus;
  uiState: "APPROVED" | "PROCESSING" | "REJECTED" | "ERROR";
  statusDetail: string | null;
  userMessage: string;
  redirectPath: string;
  reused: boolean;
};

export type PaymentOrder = {
  id: string;
  provider: string;
  status: DnxNormalizedPaymentStatus;
  amountMinor: number;
  currency: "ARS";
  externalReference: string;
  checkoutUrl: string | null;
  sourceApp: "CLICKATON";
  sourceType: "REGISTRATION" | "STORE_ORDER";
  sourceId: string;
  idempotencyKey: string;
  payloadHash: string;
  attempt: number;
  /** Mercado Pago status_detail when available (Orders Brick path). */
  statusDetail?: string | null;
  createdAt: Date;
  updatedAt: Date;
  approvedAt: Date | null;
  lastEventId: string | null;
  lastEventAt: Date | null;
};

export type CreatePaymentOrderResult =
  | { outcome: "created"; order: PaymentOrder }
  | { outcome: "reused"; order: PaymentOrder }
  | { outcome: "conflict"; code: "IDEMPOTENCY_CONFLICT"; message: string };

export type CheckoutRedirectDto = {
  registrationId: string;
  paymentOrderId: string;
  checkoutUrl: string;
  amountMinor: number;
  currency: "ARS";
  provider: string;
  status: DnxNormalizedPaymentStatus;
  reused: boolean;
  expiresAt: Date | null;
  /** Provider status_detail for Brick UX mapping (never shown raw as primary copy). */
  statusDetail?: string | null;
};

export type RegistrationPaymentStatusDto = {
  registrationId: string;
  registrationStatus: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  normalizedOrderStatus: DnxNormalizedPaymentStatus | null;
  paymentOrderId: string | null;
  provider: string | null;
  externalReferenceMasked: string | null;
  amountMinor: number;
  currency: string;
  confirmed: boolean;
  pending: boolean;
  canRetryCheckout: boolean;
  message: string;
  lastSyncedAt: Date | null;
};

export type CheckoutReturnDto = RegistrationPaymentStatusDto & {
  editionSlug: string;
  publicCode: string | null;
  holdExpiresAt: Date | null;
  /** Nunca true solo por redirect; requiere backend verificado. */
  displayAsApproved: boolean;
  /** Post-pago: User sin password/Google → activar Cuenta DNX. */
  activationRequired?: boolean;
  existingUserWithCredentials?: boolean;
};

export type NormalizedPaymentEvent = {
  eventId: string;
  orderId: string;
  status: DnxNormalizedPaymentStatus;
  amountMinor: number;
  currency: "ARS";
  provider: string;
  externalReference: string;
  sourceId: string;
  receivedAt: Date;
  signature?: string;
};

export type ApplyPaymentEventResult = {
  applied: boolean;
  duplicate: boolean;
  conflict: boolean;
  conflictCode?: string;
  registrationId: string;
  registrationStatus: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  holdsAction: "none" | "confirm" | "release_via_expire" | "keep";
  orderStatus: DnxNormalizedPaymentStatus;
};

export type CheckoutObservabilityEvent =
  | "checkout_requested"
  | "order_created"
  | "order_reused"
  | "redirect_issued"
  | "webhook_received"
  | "status_normalized"
  | "registration_confirmed"
  | "holds_released"
  | "conflict"
  | "invalid_amount"
  | "invalid_currency"
  | "finance_snapshot_skipped"
  | "price_tamper_ignored";
