import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { money } from "../../../money/index.js";
import { MercadoPagoOrdersAdapter } from "./adapter.js";
import { FakeMercadoPagoHttpClient } from "../testing/fake-client.js";
import {
  fakeMercadoPagoConfig,
  fakeOrderCreateResponse,
  fakeOrderProcessedResponse,
  FAKE_OWNER_USER_ID,
  FAKE_PARTNER_RECEIVER_ID,
  FAKE_ORDER_ID,
} from "../testing/fixtures.js";
import { NotImplementedForSafetyError } from "../../../errors/provider-errors.js";
import type { CalculatedDistribution } from "../../../distribution/types.js";

function sampleDistribution(): CalculatedDistribution {
  return {
    total: money("ARS", 100_000n),
    rounding: "LARGEST_REMAINDER",
    droppedRecipientIds: [],
    entries: [
      {
        recipientId: "platform",
        role: "PLATFORM",
        amount: money("ARS", 70_000n),
        ruleKind: "FIXED",
        priority: 10,
      },
      {
        recipientId: "photographer",
        role: "PHOTOGRAPHER",
        amount: money("ARS", 30_000n),
        ruleKind: "FIXED",
        priority: 20,
      },
    ],
  };
}

describe("MercadoPagoOrdersAdapter", () => {
  it("createOrder rejects without createSplitOrder", async () => {
    const adapter = new MercadoPagoOrdersAdapter({
      config: fakeMercadoPagoConfig(),
      ownerUserId: FAKE_OWNER_USER_ID,
    });
    await assert.rejects(
      () =>
        adapter.createOrder({
          environment: "sandbox",
          externalReference: "ref",
          total: money("ARS", 100n),
          distribution: sampleDistribution(),
          idempotencyKey: "k1",
        }),
      /createSplitOrder/,
    );
  });

  it("createSplitOrder posts to /v1/orders", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "POST" && o.path === "/v1/orders",
      response: {
        status: 201,
        headers: new Headers(),
        body: fakeOrderCreateResponse,
        rawText: "",
        problem: null,
      },
    });

    const adapter = new MercadoPagoOrdersAdapter({
      config: fakeMercadoPagoConfig(),
      ownerUserId: FAKE_OWNER_USER_ID,
      httpClient: http,
    });

    const partnerReceiverIds = new Map([["photographer", FAKE_PARTNER_RECEIVER_ID]]);
    const result = await adapter.createSplitOrder({
      environment: "sandbox",
      externalReference: "ext-ref-001",
      total: money("ARS", 100_000n),
      distribution: sampleDistribution(),
      idempotencyKey: "order-idem-1",
      deviceSessionId: "device-session-1",
      paymentToken: "TEST_CARD_TOKEN_FIXTURE",
      partnerReceiverIds,
    });

    assert.equal(result.providerOrderId, FAKE_ORDER_ID);
    assert.equal(result.status, "OPEN");
    assert.equal(http.recordedRequests[0]?.options.path, "/v1/orders");
    const body = http.recordedRequests[0]?.options.body as {
      transactions?: { payments?: Array<{ payment_method?: { token?: string } }> };
    };
    const pm = body?.transactions?.payments?.[0]?.payment_method as
      | { token?: string; id?: string }
      | undefined;
    assert.equal(pm?.token, "TEST_CARD_TOKEN_FIXTURE");
    assert.equal(pm?.id, "visa");
  });

  it("getOrder fetches order status", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "GET" && o.path.includes(FAKE_ORDER_ID),
      response: {
        status: 200,
        headers: new Headers(),
        body: fakeOrderProcessedResponse,
        rawText: "",
        problem: null,
      },
    });

    const adapter = new MercadoPagoOrdersAdapter({
      config: fakeMercadoPagoConfig(),
      ownerUserId: FAKE_OWNER_USER_ID,
      httpClient: http,
    });

    const result = await adapter.getOrder(FAKE_ORDER_ID, "sandbox");
    assert.equal(result.status, "PROCESSED_ACCREDITED");
  });

  it("refund throws NotImplementedForSafetyError", async () => {
    const adapter = new MercadoPagoOrdersAdapter({
      config: fakeMercadoPagoConfig(),
      ownerUserId: FAKE_OWNER_USER_ID,
    });
    await assert.rejects(
      () =>
        adapter.refund({
          providerOrderId: FAKE_ORDER_ID,
          idempotencyKey: "refund-1",
        }),
      NotImplementedForSafetyError,
    );
  });
});
