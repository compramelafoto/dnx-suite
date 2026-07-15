import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseMercadoPagoOrdersWebhook } from "./parser.js";
import { fakeWebhookBody, FAKE_ORDER_ID } from "../testing/fixtures.js";

describe("parseMercadoPagoOrdersWebhook", () => {
  it("parses Orders_v1 envelope", async () => {
    const result = await parseMercadoPagoOrdersWebhook({}, fakeWebhookBody, "sandbox");
    assert.equal(result.providerOrderId, FAKE_ORDER_ID);
    assert.equal(result.liveMode, false);
    assert.ok(result.eventKey.includes("orders_v1"));
    assert.ok(result.eventKey.includes(FAKE_ORDER_ID));
  });

  it("rejects invalid JSON", async () => {
    await assert.rejects(
      () => parseMercadoPagoOrdersWebhook({}, "not-json", "sandbox"),
      /Invalid webhook JSON/,
    );
  });

  it("rejects missing data.id", async () => {
    await assert.rejects(
      () => parseMercadoPagoOrdersWebhook({}, JSON.stringify({ type: "order" }), "sandbox"),
      /data.id/,
    );
  });
});
