import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createMercadoPagoRefund,
  getMercadoPagoRefund,
  createMercadoPagoOrderRefund,
  MercadoPagoRefundError,
} from "../providers/mercado-pago/refunds/index.js";
import { FakeMercadoPagoHttpClient } from "../providers/mercado-pago/testing/fake-client.js";
import { fakeMercadoPagoConfig } from "../providers/mercado-pago/testing/fixtures.js";
import { money } from "../money/index.js";

describe("Mercado Pago Orders refunds (Imp 04)", () => {
  it("legacy createMercadoPagoRefund without http throws typed error", async () => {
    await assert.rejects(
      () => createMercadoPagoRefund({ order_id: "ord-1" }),
      MercadoPagoRefundError,
    );
  });

  it("getMercadoPagoRefund directs to GET order", async () => {
    await assert.rejects(
      () => getMercadoPagoRefund("ref-1"),
      (err: unknown) =>
        err instanceof MercadoPagoRefundError && err.code === "USE_GET_ORDER",
    );
  });

  it("total refund posts empty body to /v1/orders/{id}/refund", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) =>
        o.method === "POST" && o.path === "/v1/orders/ORD123/refund",
      response: {
        status: 201,
        headers: new Headers(),
        body: {
          id: "ORD123",
          status: "refunded",
          status_detail: "refunded",
          transactions: {
            refunds: [{ id: "REF001", amount: "100.00", status: "processed" }],
          },
        },
        rawText: "",
        problem: null,
      },
    });

    const result = await createMercadoPagoOrderRefund(http, {
      providerOrderId: "ORD123",
      idempotencyKey: "idem-total",
    });
    assert.equal(result.orderStatus, "refunded");
    assert.equal(result.providerRefundIds[0], "REF001");
    const req = http.recordedRequests[0]!;
    assert.equal(req.options.body, undefined);
    assert.equal(req.options.idempotencyKey, "idem-total");
  });

  it("partial refund sends transactions[{id,amount}]", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "POST" && String(o.path).includes("/refund"),
      response: {
        status: 201,
        headers: new Headers(),
        body: {
          id: "ORD123",
          status: "processed",
          status_detail: "partially_refunded",
          transactions: {
            refunds: [
              {
                id: "REF002",
                transaction_id: "PAY01",
                amount: "20.00",
                status: "processed",
              },
            ],
          },
        },
        rawText: "",
        problem: null,
      },
    });

    const result = await createMercadoPagoOrderRefund(http, {
      providerOrderId: "ORD123",
      idempotencyKey: "idem-partial",
      amount: money("ARS", 20_00n),
      providerTransactionId: "PAY01",
    });
    assert.equal(result.statusDetail, "partially_refunded");
    const body = http.recordedRequests[0]!.options.body as {
      transactions: Array<{ id: string; amount: string }>;
    };
    assert.equal(body.transactions[0]!.id, "PAY01");
    assert.equal(body.transactions[0]!.amount, "20.00");
  });

  it("partial without transaction id fails", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    await assert.rejects(
      () =>
        createMercadoPagoOrderRefund(http, {
          providerOrderId: "ORD123",
          idempotencyKey: "x",
          amount: money("ARS", 100n),
        }),
      (err: unknown) =>
        err instanceof MercadoPagoRefundError &&
        err.code === "TRANSACTION_ID_REQUIRED",
    );
  });
});
