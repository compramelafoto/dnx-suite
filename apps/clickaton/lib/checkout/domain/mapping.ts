import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import type { DnxNormalizedPaymentStatus } from "./types";

/**
 * Mapping conservador:
 * proveedor (fake/MP mapeado) → estado DNX normalizado → efecto Clickatón.
 * No inventa enums Prisma inexistentes (p. ej. registration EXPIRED).
 */
export type ClickatonPaymentEffect = {
  registrationStatus: ClickatonRegistrationStatus | "unchanged";
  paymentStatus: ClickatonPaymentStatus | "unchanged";
  holds: "keep" | "confirm" | "release_via_expire";
  allowRetry: boolean;
  publicMessage: string;
};

/** Estados crudos del fake provider (y aliases MP típicos). */
export function mapProviderStatusToDnx(providerStatus: string): DnxNormalizedPaymentStatus {
  const s = providerStatus.trim().toUpperCase();
  switch (s) {
    case "CREATED":
    case "OPEN":
      return "CREATED";
    case "PENDING":
    case "ACTION_REQUIRED":
      return "PENDING";
    case "PROCESSING":
    case "IN_PROCESS":
    case "AUTHORIZED":
      return "PROCESSING";
    case "APPROVED":
    case "PAID":
    case "PROCESSED":
    case "PROCESSED_ACCREDITED":
    case "ACCREDITED":
      return "APPROVED";
    case "REJECTED":
    case "FAILED":
    case "DECLINED":
      return "REJECTED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "EXPIRED":
      return "EXPIRED";
    case "REFUNDED":
      return "REFUNDED";
    case "PARTIALLY_REFUNDED":
      return "PARTIALLY_REFUNDED";
    case "CHARGEBACK":
    case "CHARGED_BACK":
      return "CHARGEBACK";
    default:
      return "PENDING";
  }
}

export function mapDnxStatusToClickatonEffect(
  status: DnxNormalizedPaymentStatus,
): ClickatonPaymentEffect {
  switch (status) {
    case "CREATED":
    case "PENDING":
    case "PROCESSING":
      return {
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: status === "PROCESSING" ? "PROCESSING" : "PENDING",
        holds: "keep",
        allowRetry: false,
        publicMessage: "El pago está en proceso. La reserva se mantiene mientras no venza.",
      };
    case "APPROVED":
      return {
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
        holds: "confirm",
        allowRetry: false,
        publicMessage: "Pago confirmado. Tu inscripción quedó confirmada.",
      };
    case "REJECTED":
      return {
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: "FAILED",
        holds: "keep",
        allowRetry: true,
        publicMessage: "El pago no se completó. Podés reintentar mientras la reserva esté vigente.",
      };
    case "CANCELLED":
      return {
        registrationStatus: "CANCELLED",
        paymentStatus: "CANCELLED",
        holds: "release_via_expire",
        allowRetry: false,
        publicMessage: "El pago fue cancelado. La reserva quedó liberada.",
      };
    case "EXPIRED":
      return {
        registrationStatus: "CANCELLED",
        paymentStatus: "EXPIRED",
        holds: "release_via_expire",
        allowRetry: false,
        publicMessage: "La orden de pago expiró. La reserva quedó liberada.",
      };
    case "REFUNDED":
      return {
        registrationStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
        holds: "keep",
        allowRetry: false,
        publicMessage: "El pago fue reembolsado. La inscripción ya no figura como confirmada.",
      };
    case "PARTIALLY_REFUNDED":
      return {
        // Parcial: la inscripción sigue vigente; el cobro se identifica como reembolso parcial.
        registrationStatus: "CONFIRMED",
        paymentStatus: "PARTIALLY_REFUNDED",
        holds: "keep",
        allowRetry: false,
        publicMessage: "Hay un reembolso parcial. El saldo neto ya no es el cobro completo.",
      };
    case "CHARGEBACK":
      return {
        registrationStatus: "unchanged",
        paymentStatus: "MANUAL_REVIEW",
        holds: "keep",
        allowRetry: false,
        publicMessage: "Hay una revisión comercial. Contactá a organización.",
      };
  }
}

export function maskExternalReference(ref: string | null | undefined): string | null {
  if (!ref) return null;
  if (ref.length <= 8) return `${ref.slice(0, 2)}…`;
  return `${ref.slice(0, 4)}…${ref.slice(-4)}`;
}

export function maskPaymentOrderId(id: string | null | undefined): string | null {
  if (!id) return null;
  if (id.length <= 10) return `${id.slice(0, 4)}…`;
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
