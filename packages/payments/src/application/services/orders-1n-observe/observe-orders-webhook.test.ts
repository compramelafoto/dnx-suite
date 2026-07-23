import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createInMemoryDnxPaymentsPersistence } from "../../persistence/memory.js";
import {
  buildOrdersWebhookFixtureBody,
  signMercadoPagoTestWebhook,
} from "../../../providers/mercado-pago/webhooks/sign-test-fixture.js";
import { ORDERS_1N_WEBHOOK_OBSERVE_FLAG } from "../../../providers/mercado-pago/orders/orders-1n-observe-flag.js";
import {
  createOrdersObserveCounters,
  observeOrdersWebhook,
} from "./observe-orders-webhook.js";

const SECRET = "unit-test-orders-webhook-secret";
const ORDER_ID = "ORDTST01UNITTESTORDER1234567890";

function signedHeaders(dataId: string) {
  const signed = signMercadoPagoTestWebhook({ secret: SECRET, dataId });
  return {
    headers: {
      "x-signature": signed.signatureHeader,
      "x-request-id": signed.requestId,
    },
    requestId: signed.requestId,
  };
}

describe("observeOrdersWebhook", () => {
  it("rejects when observe flag off without CLI bypass", async () => {
    const prev = process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG];
    delete process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG];
    const persistence = createInMemoryDnxPaymentsPersistence();
    const body = buildOrdersWebhookFixtureBody({ providerOrderId: ORDER_ID });
    const { headers } = signedHeaders(ORDER_ID);
    const result = await observeOrdersWebhook({
      headers,
      rawBody: body,
      webhookSecret: SECRET,
      persistence,
      allowCliBypass: false,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "OBSERVE_FLAG_OFF");
    if (prev !== undefined) process.env[ORDERS_1N_WEBHOOK_OBSERVE_FLAG] = prev;
  });

  it("rejects live_mode true in sandbox", async () => {
    const persistence = createInMemoryDnxPaymentsPersistence();
    const body = buildOrdersWebhookFixtureBody({
      providerOrderId: ORDER_ID,
      liveMode: true,
    });
    const { headers } = signedHeaders(ORDER_ID);
    const result = await observeOrdersWebhook({
      headers,
      rawBody: body,
      webhookSecret: SECRET,
      persistence,
      allowCliBypass: true,
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, "LIVE_MODE_FORBIDDEN");
  });

  it("processes signed fixture, reconciles GET, and is idempotent", async () => {
    const persistence = createInMemoryDnxPaymentsPersistence();
    const counters = createOrdersObserveCounters();
    const body = buildOrdersWebhookFixtureBody({
      providerOrderId: ORDER_ID,
      liveMode: false,
    });
    const { headers } = signedHeaders(ORDER_ID);
    const fetchCanonicalOrder = async () => ({
      providerOrderId: ORDER_ID,
      status: "PROCESSED_ACCREDITED",
      statusDetail: "accredited",
      externalReference: "clickaton-10d3i-f-test",
      totalMinor: "100000",
      currency: "ARS",
      splitAmounts: ["34.00", "33.00", "33.00"],
      paymentCount: 1,
    });

    const first = await observeOrdersWebhook({
      headers,
      rawBody: body,
      webhookSecret: SECRET,
      persistence,
      fetchCanonicalOrder,
      allowCliBypass: true,
      counters,
      deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
      expected: {
        providerOrderId: ORDER_ID,
        status: "PROCESSED_ACCREDITED",
        totalMinor: "100000",
        expectedBps: [3400, 3300, 3300],
        snapshot: {
          idPrefix: "ods_d16a37",
          hashPrefix: "ba5dedcc6bcd",
          totalMinor: "100000",
          bps: [3400, 3300, 3300],
          externalReference: "clickaton-10d3i-e-sim-order-100000",
          agreementIdPrefix: "ea_21aa26c",
        },
      },
      snapshotRead: {
        idPrefix: "ods_d16a37",
        hashPrefix: "ba5dedcc6bcd",
        totalMinor: "100000",
        bps: [3400, 3300, 3300],
        externalReference: "clickaton-10d3i-e-sim-order-100000",
        agreementIdPrefix: "ea_21aa26c",
      },
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.outcome, "processed");
    assert.equal(first.liveMode, false);
    assert.equal(first.mismatches.length, 0);
    assert.equal(first.snapshot?.intact, true);

    const second = await observeOrdersWebhook({
      headers,
      rawBody: body,
      webhookSecret: SECRET,
      persistence,
      fetchCanonicalOrder,
      allowCliBypass: true,
      counters,
      deliveryClass: "SIGNED_REPLAY_OF_SANDBOX_ORDER",
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.outcome, "duplicate");
    assert.equal(counters.duplicates, 1);
    assert.equal(counters.processed, 1);
  });

  it("detects status mismatch vs GET", async () => {
    const persistence = createInMemoryDnxPaymentsPersistence();
    const body = buildOrdersWebhookFixtureBody({
      providerOrderId: ORDER_ID,
      liveMode: false,
    });
    const { headers } = signedHeaders(ORDER_ID);
    const result = await observeOrdersWebhook({
      headers,
      rawBody: body,
      webhookSecret: SECRET,
      persistence,
      allowCliBypass: true,
      fetchCanonicalOrder: async () => ({
        providerOrderId: ORDER_ID,
        status: "FAILED",
        statusDetail: "rejected",
        totalMinor: "100000",
        splitAmounts: ["34.00", "33.00", "33.00"],
      }),
      expected: {
        status: "PROCESSED_ACCREDITED",
        totalMinor: "100000",
        expectedBps: [3400, 3300, 3300],
      },
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.ok(result.mismatches.some((m) => m.code === "STATUS_MISMATCH"));
  });
});
