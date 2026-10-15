import assert from "node:assert/strict";
import test from "node:test";

import type { ClickatonCheckoutProviderBridge } from "@repo/payments/next";

import { wrapWithAffiliateSplitIfEnabled } from "./runtime";

function checkoutProBridge(): ClickatonCheckoutProviderBridge {
  return {
    mode: "mercado_pago_production",
    providerName: "mercadopago_preferences_legacy",
    async createCheckout() {
      return { checkoutUrl: "https://www.mercadopago.com.ar/x", providerOrderId: "pref_1", rawSanitized: {} };
    },
    async refreshCheckout() {
      return null;
    },
    async fetchPaymentById() {
      return null;
    },
  };
}

test("interruptor apagado: el puente de Checkout Pro queda intacto (mismo objeto)", () => {
  const pro = checkoutProBridge();
  assert.equal(wrapWithAffiliateSplitIfEnabled(pro, {} as NodeJS.ProcessEnv), pro);
  assert.equal(
    wrapWithAffiliateSplitIfEnabled(pro, {
      DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED: "false",
    } as unknown as NodeJS.ProcessEnv),
    pro,
  );
});

test("interruptor encendido: puente compuesto con los mismos gates LIVE", async () => {
  const pro = checkoutProBridge();
  const composite = wrapWithAffiliateSplitIfEnabled(pro, {
    DNX_CLICKATON_AFFILIATE_SPLIT_ENABLED: "true",
  } as unknown as NodeJS.ProcessEnv);
  assert.notEqual(composite, pro);
  assert.equal(composite.mode, "mercado_pago_production");
  assert.equal(composite.providerName, "mercadopago_preferences_legacy");
  // Sin tarjeta: Checkout Pro de siempre.
  const out = await composite.createCheckout({
    orderId: "o",
    amountMinor: 100,
    currency: "ARS",
    description: "d",
    externalReference: "clickaton:registration:r",
    idempotencyKey: "k",
    payloadHash: "h",
    successUrl: "https://c/ok",
    pendingUrl: "https://c/p",
    failureUrl: "https://c/e",
    sourceId: "r",
  });
  assert.equal(out.providerOrderId, "pref_1");
});
