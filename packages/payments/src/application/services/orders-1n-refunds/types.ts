import type { CurrencyCode, PaymentEnvironment } from "../../../contracts/primitives.js";
import type { Money } from "../../../money/types.js";
import type { RefundStatus } from "../../../contracts/entities.js";

/**
 * Controlled internal refund reasons.
 * Only sent to MP if/when the provider supports a matching field (Orders refund body does not).
 */
export type DnxRefundReason =
  | "customer_request"
  | "duplicate"
  | "event_cancelled"
  | "partial_adjustment"
  | "admin_correction";

export type RefundActorContext = {
  actorType: "admin" | "system" | "organizer" | "service";
  actorId: string;
  /** App / product label for audit (e.g. clickaton) — not sent to MP. */
  consumerLabel?: string;
  /**
   * When true, caller is trusted (CLI/tests/admin service).
   * When false, paymentOrderId must match authorizedPaymentOrderIds.
   */
  trustedService?: boolean;
  /** Allowed payment order ids for untrusted consumers. */
  authorizedPaymentOrderIds?: readonly string[];
};

/**
 * Canonical refund request — commercial amounts never trusted from browser.
 * amountMinor omitted = total remaining refundable.
 */
export type RefundRequest = {
  paymentOrderId: string;
  providerOrderId: string;
  /** Paid/captured total of the order (server-side). */
  orderTotalMinor: bigint;
  currency: CurrencyCode;
  environment: PaymentEnvironment;
  /** Original split shares (owner + partners) for proportional reversal. */
  originalAllocations: RefundAllocationShare[];
  /** Payment transaction id (PAY…) required for partial Orders refunds. */
  providerTransactionId?: string;
  amountMinor?: bigint;
  reason?: DnxRefundReason;
  idempotencyKey: string;
  actor: RefundActorContext;
  metadata?: Record<string, string>;
};

export type RefundAllocationShare = {
  recipientId: string;
  role: "OWNER" | "PARTNER" | "OTHER";
  /** Original allocated amount from the payment split (minor units). */
  amountMinor: bigint;
};

export type RefundAllocation = {
  recipientId: string;
  role: "OWNER" | "PARTNER" | "OTHER";
  amountMinor: bigint;
};

export type RefundResult = {
  refundId: string;
  providerRefundId: string | null;
  providerRefundIds: string[];
  paymentOrderId: string;
  providerOrderId: string;
  amountMinor: bigint;
  currency: CurrencyCode;
  status: RefundStatus;
  statusDetail: string | null;
  orderStatusAfter: "PARTIALLY_REFUNDED" | "REFUNDED" | "PAID" | "PROCESSING";
  createdAt: string;
  reused: boolean;
  allocations: RefundAllocation[];
  providerResponseRef?: string;
};

export type RefundableBalance = {
  paymentOrderId: string;
  orderTotalMinor: bigint;
  refundedMinor: bigint;
  remainingMinor: bigint;
  currency: CurrencyCode;
  fullyRefunded: boolean;
};

export type PersistedRefundRecord = {
  id: string;
  paymentOrderId: string;
  providerOrderId: string;
  providerRefundId: string | null;
  providerRefundIds: string[];
  amountMinor: bigint;
  currency: CurrencyCode;
  status: RefundStatus;
  statusDetail: string | null;
  idempotencyKey: string;
  payloadHash: string;
  reason: DnxRefundReason | null;
  allocations: RefundAllocation[];
  environment: PaymentEnvironment;
  createdAt: string;
  updatedAt: string;
  rawSanitized?: Record<string, unknown>;
};

/**
 * Allocation reversal strategy when MP does not return per-receiver refund breakdown.
 * Documented: proportional to original split amounts + LARGEST_REMAINDER so sum == refund.
 *
 * LEGAL / BUSINESS RULE REVIEW REQUIRED for irreversible provider fees.
 */
export const REFUND_ALLOCATION_STRATEGY =
  "PROPORTIONAL_TO_ORIGINAL_SPLITS_LARGEST_REMAINDER" as const;
