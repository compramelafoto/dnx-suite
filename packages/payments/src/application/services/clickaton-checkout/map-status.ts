import type { PaymentOrderStatus, ProviderOrderStatus } from "../../../contracts/entities.js";
import type { NormalizedCheckoutStatus } from "./types.js";

export function mapNormalizedToPaymentOrderStatus(
  status: NormalizedCheckoutStatus,
): PaymentOrderStatus {
  switch (status) {
    case "CREATED":
    case "PENDING":
    case "PROCESSING":
      return "AWAITING_PROVIDER";
    case "APPROVED":
      return "PAID";
    case "REJECTED":
      return "FAILED";
    case "CANCELLED":
    case "EXPIRED":
      return "CANCELED";
    case "PARTIALLY_REFUNDED":
      return "PARTIALLY_REFUNDED";
    case "REFUNDED":
      return "REFUNDED";
    case "CHARGEBACK":
      return "CHARGED_BACK";
  }
}

export function mapNormalizedToProviderMappedStatus(
  status: NormalizedCheckoutStatus,
): ProviderOrderStatus | "UNKNOWN" {
  switch (status) {
    case "CREATED":
    case "PENDING":
      return "OPEN";
    case "PROCESSING":
      return "PENDING";
    case "APPROVED":
      return "PROCESSED";
    case "REJECTED":
      return "FAILED";
    case "CANCELLED":
    case "EXPIRED":
      return "CANCELED";
    case "PARTIALLY_REFUNDED":
    case "REFUNDED":
      return "REFUNDED";
    case "CHARGEBACK":
      return "CHARGED_BACK";
  }
}

export function mapPaymentOrderStatusToNormalized(
  status: PaymentOrderStatus,
): NormalizedCheckoutStatus {
  switch (status) {
    case "CREATED":
      return "CREATED";
    case "AWAITING_PROVIDER":
    case "AUTHORIZED":
      return "PENDING";
    case "CAPTURED":
    case "PAID":
      return "APPROVED";
    case "FAILED":
      return "REJECTED";
    case "CANCELED":
      return "CANCELLED";
    case "PARTIALLY_REFUNDED":
      return "PARTIALLY_REFUNDED";
    case "REFUNDED":
      return "REFUNDED";
    case "CHARGED_BACK":
      return "CHARGEBACK";
    default:
      return "PENDING";
  }
}

export function isTerminalNormalized(status: NormalizedCheckoutStatus): boolean {
  return (
    status === "APPROVED" ||
    status === "CANCELLED" ||
    status === "EXPIRED" ||
    status === "REFUNDED" ||
    status === "PARTIALLY_REFUNDED" ||
    status === "CHARGEBACK"
  );
}

/** Ranking monotónico: evita regresar REFUNDED → APPROVED por webhook fuera de orden. */
export function normalizedStatusRank(status: NormalizedCheckoutStatus): number {
  switch (status) {
    case "CREATED":
      return 10;
    case "PENDING":
      return 20;
    case "PROCESSING":
      return 30;
    case "APPROVED":
      return 50;
    case "PARTIALLY_REFUNDED":
      return 60;
    case "REFUNDED":
    case "CHARGEBACK":
      return 70;
    case "REJECTED":
    case "CANCELLED":
    case "EXPIRED":
      return 40;
    default:
      return 0;
  }
}

/**
 * Permite avanzar hacia refunds desde APPROVED/PARTIALLY_REFUNDED;
 * bloquea regressiones (p.ej. REFUNDED → APPROVED).
 */
export function canApplyNormalizedStatusTransition(
  current: NormalizedCheckoutStatus,
  next: NormalizedCheckoutStatus,
): boolean {
  if (current === next) return true;
  if (isTerminalNormalized(current) && !isTerminalNormalized(next)) {
    return false;
  }
  // Refund path: APPROVED → PARTIALLY_REFUNDED → REFUNDED
  if (
    (current === "APPROVED" || current === "PARTIALLY_REFUNDED") &&
    (next === "PARTIALLY_REFUNDED" || next === "REFUNDED" || next === "CHARGEBACK")
  ) {
    return true;
  }
  if (current === "REFUNDED" || current === "CHARGEBACK") {
    return false;
  }
  // Misma familia terminal: no bajar de rank (APPROVED no pisa PARTIALLY_REFUNDED)
  if (isTerminalNormalized(current) && isTerminalNormalized(next)) {
    return normalizedStatusRank(next) >= normalizedStatusRank(current);
  }
  return true;
}

export function isReusableNormalized(status: NormalizedCheckoutStatus): boolean {
  return status === "CREATED" || status === "PENDING" || status === "PROCESSING";
}
