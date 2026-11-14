import { storedToMajor } from "./money";

/** Datos de la preferencia de un pedido internacional: moneda local y sin marketplace_fee. */
export function buildIntlPreferenceInput(order: { id: number; totalCents: number; currency: string }): {
  title: string;
  total: number;
  currencyId: string;
  externalReference: string;
  marketplaceFee: undefined;
} {
  return {
    title: `Compra de fotos - Pedido #${order.id}`,
    total: storedToMajor(order.totalCents, order.currency),
    currencyId: order.currency,
    externalReference: String(order.id),
    marketplaceFee: undefined,
  };
}
