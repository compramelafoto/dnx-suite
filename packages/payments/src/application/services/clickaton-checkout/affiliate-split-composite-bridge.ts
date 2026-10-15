/**
 * Puente compuesto de producción: Checkout Pro (lo de siempre) + Orders 1:N
 * para los cobros con tarjeta que reparten al fotógrafo afiliado.
 *
 * - createCheckout: Orders si viene `cardPayment` + `affiliateSplit`; si no,
 *   Checkout Pro tal cual.
 * - refreshCheckout: Orders si el id del proveedor empieza con "ORD" (ids de
 *   Orders); si no, Checkout Pro (preferencias / pagos numéricos).
 * - fetchPaymentById: Checkout Pro (webhooks de pagos).
 *
 * `mode` es "mercado_pago_production" (mismos gates LIVE que hoy) y
 * `providerName` es el de Checkout Pro: idempotencia, órdenes DNX y búsquedas
 * existentes siguen igual. El modo real de cada orden queda en
 * `rawSanitized.modality`.
 */
import type { ClickatonCheckoutProviderBridge } from "./types.js";

/** Ids de Orders de Mercado Pago (p. ej. "ORD01J…"). */
export function isMercadoPagoOrdersProviderId(providerOrderId: string): boolean {
  return /^ord/i.test(providerOrderId.trim());
}

export function createClickatonAffiliateSplitCompositeBridge(input: {
  checkoutPro: ClickatonCheckoutProviderBridge;
  ordersSplit: ClickatonCheckoutProviderBridge;
}): ClickatonCheckoutProviderBridge {
  const { checkoutPro, ordersSplit } = input;
  if (checkoutPro.mode !== "mercado_pago_production") {
    throw new Error("affiliate_split_composite_requires_production_checkout_pro");
  }
  return {
    mode: "mercado_pago_production",
    providerName: checkoutPro.providerName,
    createCheckout(params) {
      if (params.cardPayment && params.affiliateSplit) {
        return ordersSplit.createCheckout(params);
      }
      if (params.cardPayment) {
        // Una tarjeta sin reparto no tiene camino en producción: Checkout Pro
        // ignoraría el token y el comprador quedaría esperando un cobro que no ocurre.
        return Promise.reject(
          new Error("CARD_PAYMENT_WITHOUT_AFFILIATE_SPLIT: pago con tarjeta no disponible"),
        );
      }
      return checkoutPro.createCheckout(params);
    },
    async refreshCheckout(params) {
      if (isMercadoPagoOrdersProviderId(params.providerOrderId)) {
        return ordersSplit.refreshCheckout ? ordersSplit.refreshCheckout(params) : null;
      }
      return checkoutPro.refreshCheckout ? checkoutPro.refreshCheckout(params) : null;
    },
    ...(checkoutPro.fetchPaymentById
      ? { fetchPaymentById: checkoutPro.fetchPaymentById.bind(checkoutPro) }
      : {}),
  };
}
