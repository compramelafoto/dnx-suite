import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractMercadoPagoDataId,
  parseMercadoPagoPaymentNotification,
} from "./payment-notification.js";

describe("parseMercadoPagoPaymentNotification", () => {
  it("parsea body oficial payment.updated", () => {
    const raw = JSON.stringify({
      action: "payment.updated",
      api_version: "v1",
      data: { id: "169962120634" },
      date_created: "2026-07-22T08:25:45Z",
      id: 123,
      live_mode: true,
      type: "payment",
      user_id: "31",
    });
    const result = parseMercadoPagoPaymentNotification({ rawBody: raw });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.notification.dataId, "169962120634");
      assert.equal(result.notification.action, "payment.updated");
      assert.equal(result.notification.liveMode, true);
      assert.equal(result.notification.type, "payment");
    }
  });

  it("prioriza data.id de query sobre body", () => {
    const raw = JSON.stringify({
      type: "payment",
      data: { id: "from-body" },
    });
    assert.equal(
      extractMercadoPagoDataId({ rawBody: raw, queryDataId: "from-query" }),
      "from-query",
    );
  });

  it("rechaza data.id ausente", () => {
    const result = parseMercadoPagoPaymentNotification({
      rawBody: JSON.stringify({ type: "payment", action: "payment.created" }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "WEBHOOK_MISSING_DATA_ID");
  });

  it("ignora tipos no payment", () => {
    const result = parseMercadoPagoPaymentNotification({
      rawBody: JSON.stringify({ type: "merchant_order", data: { id: "1" } }),
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "WEBHOOK_IGNORED_TYPE");
  });

  it("rechaza JSON inválido", () => {
    const result = parseMercadoPagoPaymentNotification({ rawBody: "not-json" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "WEBHOOK_INVALID_BODY");
  });
});
