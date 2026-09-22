import type { GiftVoucherStatus } from "../domain/status";

export type GiftStatusTone = "neutral" | "warning" | "success" | "danger";

export type GiftStatusPresentation = {
  label: string;
  /** Qué significa para quien mira el panel, sin jerga. */
  hint: string;
  tone: GiftStatusTone;
  /** true si todavía ocupa un cupo de la edición. */
  ocupaCupo: boolean;
};

const PRESENTATION: Record<GiftVoucherStatus, GiftStatusPresentation> = {
  PENDING_PAYMENT: {
    label: "Esperando pago",
    hint: "Se empezó la compra y el pago no se acreditó. Si no llega, se cancela sola.",
    tone: "neutral",
    ocupaCupo: false,
  },
  ACTIVE: {
    label: "Sin activar",
    hint: "Pago acreditado. El cupo está guardado esperando que lo activen.",
    tone: "warning",
    ocupaCupo: true,
  },
  REDEEMED: {
    label: "Activado",
    hint: "Ya hay una persona inscripta con este regalo.",
    tone: "success",
    ocupaCupo: true,
  },
  CARRIED_OVER: {
    label: "Pasó a la próxima",
    hint: "Cerró la inscripción sin activarse. El cupo se liberó y el regalo sigue válido.",
    tone: "neutral",
    ocupaCupo: false,
  },
  CANCELLED: {
    label: "Anulado",
    hint: "Se anuló y el cupo volvió a la venta.",
    tone: "danger",
    ocupaCupo: false,
  },
  REFUNDED: {
    label: "Devuelto",
    hint: "Se devolvió la plata y el cupo volvió a la venta.",
    tone: "danger",
    ocupaCupo: false,
  },
};

export function presentGiftStatus(status: GiftVoucherStatus): GiftStatusPresentation {
  return PRESENTATION[status];
}

/** Sólo un regalo pagado y sin activar se puede anular o reemitir. */
export function canManageGiftVoucher(status: GiftVoucherStatus): {
  anular: boolean;
  reemitir: boolean;
  reenviar: boolean;
} {
  return {
    anular: status === "PENDING_PAYMENT" || status === "ACTIVE",
    reemitir: status === "ACTIVE",
    reenviar: status === "ACTIVE",
  };
}

export function giftToneToBadgeVariant(
  tone: GiftStatusTone,
): "neutral" | "warning" | "success" | "danger" {
  return tone;
}
