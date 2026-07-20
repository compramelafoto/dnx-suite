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

export function countsAsActiveRegistration(input: {
  status: ClickatonRegistrationStatus;
  holdExpiresAt: Date | null | undefined;
  now: Date;
}): boolean {
  if (["CANCELLED", "REFUNDED", "DISQUALIFIED"].includes(input.status)) return false;
  if (isStalePendingHold(input)) return false;
  return true;
}
