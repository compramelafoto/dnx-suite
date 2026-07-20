/**
 * Mapping Mercado Pago Checkout Pro / Payments → estados DNX normalizados.
 */
import type { NormalizedCheckoutStatus } from "../../../application/services/clickaton-checkout/types";

export function mapMercadoPagoPaymentStatusToNormalized(
  status: string | null | undefined,
): NormalizedCheckoutStatus {
  const s = (status ?? "").toLowerCase();
  switch (s) {
    case "pending":
      return "PENDING";
    case "in_process":
    case "in_mediation":
      return "PROCESSING";
    case "approved":
      return "APPROVED";
    case "rejected":
      return "REJECTED";
    case "cancelled":
    case "canceled":
      return "CANCELLED";
    case "refunded":
      return "REFUNDED";
    case "charged_back":
      return "CHARGEBACK";
    case "expired":
      return "EXPIRED";
    default:
      return "PENDING";
  }
}

export function mapNormalizedToClickatonEffect(status: NormalizedCheckoutStatus): {
  registrationHint: string;
  paymentHint: string;
} {
  switch (status) {
    case "APPROVED":
      return { registrationHint: "CONFIRMED", paymentHint: "APPROVED" };
    case "REJECTED":
      return { registrationHint: "PENDING_PAYMENT", paymentHint: "FAILED" };
    case "CANCELLED":
      return { registrationHint: "CANCELLED", paymentHint: "CANCELLED" };
    case "EXPIRED":
      return { registrationHint: "CANCELLED", paymentHint: "EXPIRED" };
    case "REFUNDED":
    case "CHARGEBACK":
      return { registrationHint: "MANUAL_REVIEW", paymentHint: "MANUAL_REVIEW" };
    case "PROCESSING":
      return { registrationHint: "PENDING_PAYMENT", paymentHint: "PROCESSING" };
    case "PENDING":
    case "CREATED":
    default:
      return { registrationHint: "PENDING_PAYMENT", paymentHint: "PENDING" };
  }
}
