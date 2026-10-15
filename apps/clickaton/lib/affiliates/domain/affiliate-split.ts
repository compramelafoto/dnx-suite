/**
 * ¿Este cobro reparte la comisión al fotógrafo afiliado en el mismo pago?
 *
 * Puro: el checkout le pasa la comisión anotada (PENDING), el receptor con
 * permiso ACTIVO y lo que se va a cobrar ahora. Ante cualquier duda dice que no
 * y la comisión queda para pagarse a mano (nunca se arma un reparto dudoso).
 */

import { computeAffiliateCommission } from "./commission";

/** Interruptor general del cobro dividido (apagado por defecto). */
export const AFFILIATE_SPLIT_FLAG = "DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED";

export function isAffiliateSplitEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = (env[AFFILIATE_SPLIT_FLAG] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export type AffiliateSplitCommissionRow = {
  affiliateId: string;
  status: string;
  mode: string | null;
  baseAmount: number;
  commissionBps: number;
  mpFeeBps: number;
  netAmount: number;
};

export type AffiliateSplit = {
  recipientId: string;
  receiverId: string;
  partnerAmountMinor: number;
};

export type AffiliateSplitSkipReason =
  | "flag_off"
  | "no_card"
  | "no_commission"
  | "commission_not_pending"
  | "no_active_receiver"
  | "collector_not_dnx"
  | "amount_changed"
  | "not_splittable";

export type AffiliateSplitDecision =
  | { split: AffiliateSplit }
  | { split: null; reason: AffiliateSplitSkipReason };

export type DecideAffiliateSplitInput = {
  flagEnabled: boolean;
  hasCardPayment: boolean;
  commission: AffiliateSplitCommissionRow | null;
  receiver: { receiverId: string; recipientId: string } | null;
  /** Lo que se cobra ahora (el monto elegible del checkout). */
  totalAmountMinor: number;
  /**
   * Payment account collector de la edición y el de DNX. El reparto sólo se
   * arma si cobra la cuenta dueña del permiso. Omitir para no verificarlo
   * (p. ej. al decidir qué pantalla de pago mostrar).
   */
  collector?: { paymentAccountId: string | null; expectedPaymentAccountId: string };
};

export function decideAffiliateSplit(input: DecideAffiliateSplitInput): AffiliateSplitDecision {
  if (!input.flagEnabled) return { split: null, reason: "flag_off" };
  if (!input.hasCardPayment) return { split: null, reason: "no_card" };
  const row = input.commission;
  if (!row) return { split: null, reason: "no_commission" };
  if (row.status !== "PENDING") return { split: null, reason: "commission_not_pending" };
  const receiverId = input.receiver?.receiverId.trim();
  const recipientId = input.receiver?.recipientId.trim();
  if (!receiverId || !recipientId) return { split: null, reason: "no_active_receiver" };
  if (
    input.collector &&
    input.collector.paymentAccountId !== input.collector.expectedPaymentAccountId
  ) {
    return { split: null, reason: "collector_not_dnx" };
  }

  let recomputed;
  try {
    recomputed = computeAffiliateCommission({
      baseAmount: row.baseAmount,
      commissionBps: row.commissionBps,
      mpFeeBps: row.mpFeeBps,
      totalAmount: input.totalAmountMinor,
    });
  } catch {
    return { split: null, reason: "not_splittable" };
  }
  // Lo anotado al inscribirse tiene que seguir valiendo con el total de ahora.
  if (recomputed.netAmount !== row.netAmount) return { split: null, reason: "amount_changed" };
  if (!recomputed.splittable) return { split: null, reason: "not_splittable" };

  return {
    split: { recipientId, receiverId, partnerAmountMinor: row.netAmount },
  };
}
