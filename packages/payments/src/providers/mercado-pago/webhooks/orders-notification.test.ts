import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMercadoPagoOrdersWebhookType,
  parseMercadoPagoOrdersNotification,
} from "./orders-notification.js";
import { signMercadoPagoTestWebhook, buildOrdersWebhookFixtureBody } from "./sign-test-fixture.js";
import { verifyMercadoPagoWebhookSignature } from "./signature.js";
import { parseMercadoPagoPaymentNotification } from "./payment-notification.js";

describe("Orders webhook notification", () => {
  it("classifies order types", () => {
    assert.equal(isMercadoPagoOrdersWebhookType("order"), true);
    assert.equal(isMercadoPagoOrdersWebhookType("order.processed"), true);
    assert.equal(isMercadoPagoOrdersWebhookType("payment"), false);
  });

  it("parses order envelope with live_mode false", () => {
    const body = buildOrdersWebhookFixtureBody({
      providerOrderId: "ORDTST01ABC",
      liveMode: false,
    });
    const parsed = parseMercadoPagoOrdersNotification({ rawBody: body });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.notification.dataId, "ORDTST01ABC");
    assert.equal(parsed.notification.liveMode, false);
  });

  /**
   * Confirmado por Mercado Pago: Orders API usa el tópico `order`; `payment`
   * queda para Checkout Pro / arquitectura anterior. Las dos semánticas no se
   * mezclan: cada parser ignora el tópico del otro.
   */
  it("no mezcla semánticas: `payment` no entra al pipeline Orders", () => {
    const paymentBody = JSON.stringify({
      type: "payment",
      action: "payment.updated",
      live_mode: false,
      data: { id: "1234567890" },
    });

    const asOrders = parseMercadoPagoOrdersNotification({ rawBody: paymentBody });
    assert.equal(asOrders.ok, false);
    if (!asOrders.ok) assert.equal(asOrders.code, "WEBHOOK_IGNORED_TYPE");

    // Y sigue siendo procesable por la ruta legacy (soporte NO eliminado).
    const asPayment = parseMercadoPagoPaymentNotification({ rawBody: paymentBody });
    assert.equal(asPayment.ok, true);
    if (asPayment.ok) assert.equal(asPayment.notification.dataId, "1234567890");
  });

  it("no mezcla semánticas: `order` no entra al parser de payment", () => {
    const orderBody = buildOrdersWebhookFixtureBody({
      providerOrderId: "ORDTST01ABC",
      liveMode: false,
    });

    const asPayment = parseMercadoPagoPaymentNotification({ rawBody: orderBody });
    assert.equal(asPayment.ok, false);
    if (!asPayment.ok) assert.equal(asPayment.code, "WEBHOOK_IGNORED_TYPE");

    const asOrders = parseMercadoPagoOrdersNotification({ rawBody: orderBody });
    assert.equal(asOrders.ok, true);
  });

  it("signs and verifies TEST fixture", () => {
    const secret = "test-orders-webhook-secret";
    const dataId = "ORDTST01KY6FZJ3BWK32RG6K2G93GTF1";
    const signed = signMercadoPagoTestWebhook({ secret, dataId });
    const verified = verifyMercadoPagoWebhookSignature({
      signatureHeader: signed.signatureHeader,
      requestIdHeader: signed.requestId,
      dataId,
      secret,
    });
    assert.equal(verified.ok, true);
  });
});
