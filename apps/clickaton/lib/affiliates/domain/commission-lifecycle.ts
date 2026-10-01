/**
 * Ciclo de vida de una comisión de afiliado (una por inscripción).
 *
 *   PENDING ──pago──▶ PAID_BY_SPLIT (modo SPLIT) | OWED (modo MANUAL)
 *   OWED ──transferencia a mano──▶ PAID_OUT          (lo hace el panel)
 *   cualquiera ──reversa──▶ REVERSED
 *
 * La reversa nunca borra lo que pasó: si ya se le había pagado en el mismo
 * cobro, o ya se le transfirió, el motivo lo dice para que alguien lo recupere.
 */

import type { AffiliateCommissionMode, AffiliateCommissionStatus } from "./labels";

export type CommissionLifecycleState = {
  status: AffiliateCommissionStatus;
  /** Lo define el checkout: SPLIT cuando el cobro ya repartió al afiliado. */
  mode: AffiliateCommissionMode | null;
};

export type CommissionLifecycleEvent =
  /**
   * `paidViaSplit`: el cobro salió por la orden con reparto (referencia con
   * guiones). Respaldo por si no llegó a guardarse `mode = SPLIT` después de
   * cobrar: sin esto quedaría "a transferir" y se le pagaría dos veces.
   */
  | { type: "PAID"; paidViaSplit?: boolean }
  | { type: "REVERSE"; reason: string };

export type CommissionLifecycleChange = {
  status: AffiliateCommissionStatus;
  mode: AffiliateCommissionMode | null;
  /** Sólo en la reversa. */
  reversalReason?: string;
  /** Al cobrar: la fecha del cobro. */
  setPaidAt?: boolean;
  /** Al revertir: la fecha de la reversa. */
  setReversedAt?: boolean;
};

export const RECOVER_FROM_AFFILIATE_NOTE = "reembolso: recuperar del afiliado";
export const REVERSED_AFTER_PAYOUT_NOTE = "reembolso posterior a la transferencia";

function withNote(reason: string, note: string): string {
  const base = reason.trim();
  return base.length > 0 ? `${base} — ${note}` : note;
}

/**
 * Próximo estado de la comisión, o null si el evento no cambia nada (es
 * idempotente: un pago repetido o una segunda reversa no hacen nada).
 */
export function nextCommissionState(
  current: CommissionLifecycleState,
  event: CommissionLifecycleEvent,
): CommissionLifecycleChange | null {
  if (event.type === "PAID") {
    // Sólo una reservada se cobra. Una anulada no revive por un pago tardío:
    // ese caso lo mira una persona (la inscripción queda en revisión manual).
    if (current.status !== "PENDING") return null;
    if (current.mode === "SPLIT" || event.paidViaSplit) {
      return { status: "PAID_BY_SPLIT", mode: "SPLIT", setPaidAt: true };
    }
    return { status: "OWED", mode: "MANUAL", setPaidAt: true };
  }

  const reason = event.reason.trim() || "anulada";
  switch (current.status) {
    case "REVERSED":
      return null;
    case "PAID_BY_SPLIT":
      return {
        status: "REVERSED",
        mode: current.mode,
        reversalReason: withNote(reason, RECOVER_FROM_AFFILIATE_NOTE),
        setReversedAt: true,
      };
    case "PAID_OUT":
      // Se marca igual (el fotógrafo pierde la comisión) pero el motivo avisa
      // que la plata ya salió; `paidOutAt` no se toca.
      return {
        status: "REVERSED",
        mode: current.mode,
        reversalReason: withNote(reason, REVERSED_AFTER_PAYOUT_NOTE),
        setReversedAt: true,
      };
    case "PENDING":
    case "OWED":
    default:
      return {
        status: "REVERSED",
        mode: current.mode,
        reversalReason: reason,
        setReversedAt: true,
      };
  }
}
