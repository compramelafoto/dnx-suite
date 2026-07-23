import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMercadoPagoOrdersWebhookType,
  parseMercadoPagoOrdersNotification,
} from "./orders-notification.js";
import { signMercadoPagoTestWebhook, buildOrdersWebhookFixtureBody } from "./sign-test-fixture.js";
import { verifyMercadoPagoWebhookSignature } from "./signature.js";

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
