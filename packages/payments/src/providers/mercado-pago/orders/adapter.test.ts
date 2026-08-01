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
import type { CalculatedDistribution } from "../../../distribution/types.js";
import { defaultTestSplitExtras } from "./test-helpers.js";

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
      allowTestFixtures: true,
      defaultStatementDescriptor: "DNX",
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

  it("createSplitOrder posts to /v1/orders with homologation payload", async () => {
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
      allowTestFixtures: true,
      defaultStatementDescriptor: "DNX",
    });

    const extras = defaultTestSplitExtras({
      partners: [["photographer", FAKE_PARTNER_RECEIVER_ID]],
    });
    const result = await adapter.createSplitOrder({
      environment: "sandbox",
      externalReference: "ext-ref-001",
      total: money("ARS", 100_000n),
      distribution: sampleDistribution(),
      idempotencyKey: "order-idem-1",
      paymentToken: "TEST_CARD_TOKEN_FIXTURE",
      ...extras,
    });

    assert.equal(result.providerOrderId, FAKE_ORDER_ID);
    assert.equal(result.status, "OPEN");
    assert.equal(http.recordedRequests[0]?.options.path, "/v1/orders");
    const body = http.recordedRequests[0]?.options.body as {
      type?: string;
      payer?: { email?: string };
      items?: Array<{ unit_price?: string; quantity?: number }>;
      additional_info?: unknown;
      config?: { split_rules?: { amount_type?: string } };
      transactions?: {
        payments?: Array<{
          payment_method?: { token?: string; id?: string; statement_descriptor?: string };
        }>;
      };
    };
    const headers = http.recordedRequests[0]?.options.headers as Record<string, string>;
    assert.equal(body?.type, "online");
    assert.equal(body?.payer?.email, "test_buyer@testuser.com");
    assert.equal(body?.config?.split_rules?.amount_type, "fixed");
    assert.equal(body?.items?.[0]?.quantity, 1);
    assert.equal(body?.additional_info, undefined);
    assert.equal(
      body?.transactions?.payments?.[0]?.payment_method?.statement_descriptor,
      "DNX",
    );
    assert.equal(headers["x-meli-session-id"], extras.deviceSessionId);
    assert.equal(http.recordedRequests[0]?.options.idempotencyKey, "order-idem-1");
    const pm = body?.transactions?.payments?.[0]?.payment_method;
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
      allowTestFixtures: true,
    });

    const result = await adapter.getOrder(FAKE_ORDER_ID, "sandbox");
    assert.equal(result.status, "PROCESSED_ACCREDITED");
  });

  it("refund posts to Orders API /refund (fake HTTP)", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) =>
        o.method === "POST" &&
        o.path === `/v1/orders/${FAKE_ORDER_ID}/refund`,
      response: {
        status: 201,
        headers: new Headers(),
        body: {
          id: FAKE_ORDER_ID,
          status: "refunded",
          status_detail: "refunded",
          transactions: {
            refunds: [{ id: "REF_FAKE", amount: "10.00", status: "processed" }],
          },
        },
        rawText: "",
        problem: null,
      },
    });
    const adapter = new MercadoPagoOrdersAdapter({
      config: fakeMercadoPagoConfig(),
      ownerUserId: FAKE_OWNER_USER_ID,
      httpClient: http,
      allowTestFixtures: true,
    });
    const result = await adapter.refund({
      providerOrderId: FAKE_ORDER_ID,
      idempotencyKey: "refund-1",
    });
    assert.equal(result.providerRefundId, "REF_FAKE");
    assert.equal(result.orderStatus, "refunded");
  });
});
