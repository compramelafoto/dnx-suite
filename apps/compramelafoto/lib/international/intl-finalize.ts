import { storedToMajor } from "./money";
import { localStoredToUsdCentsCeil, pickRate } from "./fx";
import { INTL_SNAPSHOT_KEY } from "./intl-order";
import { crossedLowBalance } from "./wallet";

/** El pago tiene que ser en la moneda del pedido y por el mismo monto (±1 unidad mayor). */
export function checkIntlPayment(
  order: { totalCents: number; currency: string },
  pay: { currency_id: string; transaction_amount: number },
): { ok: true } | { ok: false; reason: "CURRENCY" | "AMOUNT" } {
  if (pay.currency_id !== order.currency) return { ok: false, reason: "CURRENCY" };
  const expected = storedToMajor(order.totalCents, order.currency);
  if (Math.abs(Number(pay.transaction_amount) - expected) > 1) return { ok: false, reason: "AMOUNT" };
  return { ok: true };
}

export function commissionForOrder(snapshot: unknown): { commissionStored: number; currency: string } | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const intl = (snapshot as Record<string, unknown>)[INTL_SNAPSHOT_KEY];
  if (!intl || typeof intl !== "object") return null;
  const { commissionStored, currency } = intl as { commissionStored?: unknown; currency?: unknown };
  if (typeof commissionStored !== "number" || typeof currency !== "string") return null;
  return { commissionStored, currency };
}

export type IntlCommissionDeps = {
  loadOrder: (orderId: number) => Promise<{
    id: number;
    currency: string;
    pricingSnapshot: unknown;
    ownerUserId: number | null;
    ownerEmail: string | null;
  } | null>;
  latestFxRate: (currency: string) => Promise<{
    id: string;
    unitsPerUsdBuy: string;
    unitsPerUsdSell: string;
    fetchedAt: Date;
  } | null>;
  recordCommission: (p: {
    userId: number;
    orderId: number;
    localCurrency: string;
    localAmount: number;
    fxRateId: string | null;
    fxUnitsPerUsd: string | null;
    amountUsdCents: number;
  }) => Promise<{ created: boolean; balanceBefore: number; balanceAfter: number }>;
  sendLowBalanceEmail: (to: string, balanceUsdCents: number) => Promise<void>;
};

/**
 * Descuenta la comisión del pedido del saldo en dólares del fotógrafo (valor de compra,
 * regla 6.8 bis). Una sola vez por pedido; el aviso de saldo bajo sale solo la primera vez.
 */
export async function applyIntlCommission(
  orderId: number,
  deps?: IntlCommissionDeps,
): Promise<{ created: boolean; lowBalanceCrossed: boolean }> {
  const d = deps ?? (await import("./intl-finalize-deps")).defaultIntlCommissionDeps;
  const order = await d.loadOrder(orderId);
  const commission = order ? commissionForOrder(order.pricingSnapshot) : null;
  if (!order || !commission || order.ownerUserId == null) {
    throw new Error(`[intl] pedido ${orderId} sin datos de comisión internacional`);
  }
  const rate = await d.latestFxRate(commission.currency);
  if (!rate) throw new Error(`[intl] pedido ${orderId} sin cotización para ${commission.currency}`);
  const unitsPerUsd = pickRate(rate, "BUY");
  const amountUsdCents = localStoredToUsdCentsCeil(commission.commissionStored, commission.currency, unitsPerUsd);
  const res = await d.recordCommission({
    userId: order.ownerUserId,
    orderId,
    localCurrency: commission.currency,
    localAmount: commission.commissionStored,
    fxRateId: rate.id,
    fxUnitsPerUsd: rate.unitsPerUsdBuy,
    amountUsdCents,
  });
  const lowBalanceCrossed = res.created && crossedLowBalance(res.balanceBefore, res.balanceAfter);
  if (lowBalanceCrossed && order.ownerEmail) {
    await d.sendLowBalanceEmail(order.ownerEmail, res.balanceAfter);
  }
  return { created: res.created, lowBalanceCrossed };
}
