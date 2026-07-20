import type { PaymentOrderStatus, ProviderOrderStatus } from "../../../contracts/entities";
import type { NormalizedCheckoutStatus } from "./types";

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
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
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
    status === "CHARGEBACK"
  );
}

export function isReusableNormalized(status: NormalizedCheckoutStatus): boolean {
  return status === "CREATED" || status === "PENDING" || status === "PROCESSING";
}
