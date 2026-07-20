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
  sourceType: "REGISTRATION";
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
  sourceType: "REGISTRATION";
  sourceId: string;
  idempotencyKey: string;
  payloadHash: string;
  attempt: number;
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
  | "invalid_currency";
