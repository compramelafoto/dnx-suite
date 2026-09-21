/**
 * Ciclo de vida del regalo de inscripción.
 *
 * El voucher nace cuando el regalador confirma la compra, se activa cuando el
 * pago se acredita, y muere cuando quien lo recibe lo canjea — o cuando la
 * inscripción de la edición cierra sin que nadie lo haya activado, y entonces
 * pasa como crédito a la edición siguiente.
 */
export type GiftVoucherStatus =
  | "PENDING_PAYMENT"
  | "ACTIVE"
  | "REDEEMED"
  | "CARRIED_OVER"
  | "CANCELLED"
  | "REFUNDED";

export type GiftRedeemBlockCode =
  | "NOT_PAID"
  | "ALREADY_REDEEMED"
  | "CANCELLED"
  | "CARRIED_OVER"
  | "WINDOW_CLOSED"
  | "MODULE_DISABLED";

export type GiftRedeemAllowed = { ok: true };
export type GiftRedeemBlock = {
  ok: false;
  code: GiftRedeemBlockCode;
  message: string;
};

const BLOCK_MESSAGES: Record<GiftRedeemBlockCode, string> = {
  NOT_PAID:
    "Este regalo todavía no está disponible: el pago no se acreditó. Probá de nuevo en unos minutos.",
  ALREADY_REDEEMED: "Este regalo ya fue activado.",
  CANCELLED: "Este regalo fue anulado. Escribinos si creés que es un error.",
  CARRIED_OVER:
    "La inscripción de esta edición ya cerró. Tu regalo quedó guardado para la próxima Clickatón.",
  WINDOW_CLOSED: "La inscripción de esta edición ya cerró.",
  MODULE_DISABLED: "Los regalos no están habilitados en esta edición.",
};

function block(code: GiftRedeemBlockCode): GiftRedeemBlock {
  return { ok: false, code, message: BLOCK_MESSAGES[code] };
}

/**
 * Decide si quien tiene el código puede activarlo ahora.
 * El plazo propio del voucher manda; si no tiene, vale el cierre de la edición.
 */
export function evaluateGiftRedeemEligibility(input: {
  status: GiftVoucherStatus;
  redeemableUntil: Date | null;
  editionRegistrationCloseAt: Date | null;
  giftVouchersEnabled: boolean;
  now: Date;
}): GiftRedeemAllowed | GiftRedeemBlock {
  if (!input.giftVouchersEnabled) return block("MODULE_DISABLED");
  if (input.status === "PENDING_PAYMENT") return block("NOT_PAID");
  if (input.status === "REDEEMED") return block("ALREADY_REDEEMED");
  if (input.status === "CARRIED_OVER") return block("CARRIED_OVER");
  if (input.status === "CANCELLED" || input.status === "REFUNDED") {
    return block("CANCELLED");
  }

  const deadline = input.redeemableUntil ?? input.editionRegistrationCloseAt;
  if (deadline && deadline.getTime() < input.now.getTime()) {
    return block("WINDOW_CLOSED");
  }
  return { ok: true };
}

/**
 * Un regalo pagado que nadie activó antes del cierre no se pierde: libera el
 * cupo y queda para la edición siguiente.
 */
export function canCarryOverGiftVoucher(input: {
  status: GiftVoucherStatus;
  redeemableUntil: Date | null;
  now: Date;
}): boolean {
  if (input.status !== "ACTIVE") return false;
  if (!input.redeemableUntil) return false;
  return input.redeemableUntil.getTime() < input.now.getTime();
}
