import type {
  ClickatonPaymentStatus,
  ClickatonRegistrationStatus,
} from "@/lib/registration/domain/types";

/**
 * Reglas centralizadas 10D3F-B.
 * No existe ClickatonRegistrationStatus.EXPIRED → usamos CANCELLED + payment EXPIRED
 * (alineado a DESIGN_STATUS_TO_DOMAIN.PAYMENT_EXPIRED).
 */
export const EXPIRATION_TARGET = {
  status: "CANCELLED" as ClickatonRegistrationStatus,
  paymentStatus: "EXPIRED" as ClickatonPaymentStatus,
  auditAction: "PUBLIC_REGISTRATION_EXPIRED",
  holdStatus: "EXPIRED" as const,
};

export function isExpireCandidate(input: {
  status: ClickatonRegistrationStatus;
  paymentStatus: ClickatonPaymentStatus;
  holdExpiresAt: Date | null | undefined;
  now: Date;
}): boolean {
  if (input.status !== "PENDING_PAYMENT" && input.status !== "DRAFT") return false;
  if (input.paymentStatus === "APPROVED") return false;
  if (!input.holdExpiresAt) return false;
  return input.holdExpiresAt.getTime() <= input.now.getTime();
}

/** Hold vencido aún no materializado como CANCELLED — tratar como inactivo para cupo/duplicados. */
export function isStalePendingHold(input: {
  status: ClickatonRegistrationStatus;
  holdExpiresAt: Date | null | undefined;
  now: Date;
}): boolean {
  if (input.status !== "PENDING_PAYMENT" && input.status !== "DRAFT") return false;
  if (!input.holdExpiresAt) return false;
  return input.holdExpiresAt.getTime() <= input.now.getTime();
}

/**
 * ¿Este registro ya es "la inscripción de esta persona" en esta edición?
 *
 * Se usa para detectar duplicados por email y por documento — NO para contar
 * cupo. El cupo lo dan las inscripciones CONFIRMED más los holds ACTIVE.
 *
 * Un regalo sin activar lleva el email de quien lo compró, no el de quien va
 * a participar. Si contara, comprar un regalo para un amigo dejaría a quien
 * regala sin poder inscribirse él mismo.
 */
export function countsAsActiveRegistration(input: {
  status: ClickatonRegistrationStatus;
  holdExpiresAt: Date | null | undefined;
  now: Date;
  /** true mientras el regalo no fue activado por quien lo recibe. */
  isGift?: boolean;
}): boolean {
  if (["CANCELLED", "REFUNDED", "DISQUALIFIED"].includes(input.status)) return false;
  if (input.status === "GIFT_AWAITING_REDEMPTION") return false;
  // Un regalo recién comprado, todavía sin pagar, tampoco es su inscripción.
  if (input.isGift && input.status === "DRAFT") return false;
  if (isStalePendingHold(input)) return false;
  return true;
}
