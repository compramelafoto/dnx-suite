import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";
import type { DnxNormalizedPaymentStatus } from "./types";

/**
 * Precedencia financiera Clickatón (Imp-03).
 *
 * REFUNDED / CHARGEBACK > APPROVED > expiración automática.
 * Un APPROVED remoto válido debe recuperar una cancelación por hold vencido.
 * Cancelación admin/manual explícita no se revive en silencio.
 */

export type LateApprovalRecoveryKind =
  | "none"
  | "revive_auto_expiration"
  | "blocked_refunded"
  | "blocked_manual_cancel"
  | "blocked_terminal";

export function isAutoExpirationTerminal(input: {
  registrationStatus: ClickatonRegistrationStatus | string;
  paymentStatus: ClickatonPaymentStatus | string;
}): boolean {
  return (
    input.registrationStatus === "CANCELLED" &&
    (input.paymentStatus === "EXPIRED" ||
      input.paymentStatus === "PENDING" ||
      input.paymentStatus === "PROCESSING" ||
      input.paymentStatus === "MANUAL_REVIEW")
  );
}

/**
 * ¿Puede un APPROVED remoto confirmar (o revivir) esta inscripción?
 */
export function classifyLateApprovalRecovery(input: {
  registrationStatus: ClickatonRegistrationStatus | string;
  paymentStatus: ClickatonPaymentStatus | string;
  orderStatus: DnxNormalizedPaymentStatus | string;
  capacityHoldActive: boolean;
  holdExpired: boolean;
}): LateApprovalRecoveryKind {
  if (input.orderStatus !== "APPROVED") return "none";

  if (
    input.registrationStatus === "REFUNDED" ||
    input.paymentStatus === "REFUNDED" ||
    input.paymentStatus === "PARTIALLY_REFUNDED"
  ) {
    return "blocked_refunded";
  }

  if (
    input.registrationStatus === "DISQUALIFIED" ||
    input.registrationStatus === "TRANSFERRED_TO_NEXT_EDITION"
  ) {
    return "blocked_terminal";
  }

  // Cancelación con cobro CANCELLED (no EXPIRED) → típicamente manual / orden cancelada.
  if (
    input.registrationStatus === "CANCELLED" &&
    input.paymentStatus === "CANCELLED"
  ) {
    return "blocked_manual_cancel";
  }

  if (
    input.registrationStatus === "CONFIRMED" &&
    input.paymentStatus === "APPROVED"
  ) {
    return "none";
  }

  // Hold vencido o liberado por expiración automática → recuperar con APPROVED.
  if (
    isAutoExpirationTerminal(input) ||
    ((input.registrationStatus === "PENDING_PAYMENT" ||
      input.registrationStatus === "DRAFT") &&
      (input.holdExpired || !input.capacityHoldActive))
  ) {
    return "revive_auto_expiration";
  }

  return "none";
}

/** ¿El cron de expiración puede tocar esta inscripción? */
export function expirationCronMayTouch(input: {
  registrationStatus: ClickatonRegistrationStatus | string;
  paymentStatus: ClickatonPaymentStatus | string;
}): boolean {
  if (input.paymentStatus === "APPROVED") return false;
  if (input.registrationStatus === "CONFIRMED") return false;
  if (input.registrationStatus === "REFUNDED") return false;
  if (
    input.paymentStatus === "REFUNDED" ||
    input.paymentStatus === "PARTIALLY_REFUNDED"
  ) {
    return false;
  }
  return (
    input.registrationStatus === "PENDING_PAYMENT" ||
    input.registrationStatus === "DRAFT"
  );
}
