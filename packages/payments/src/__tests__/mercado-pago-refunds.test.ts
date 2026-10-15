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

  /**
   * MP confirmó el 13/10/2026 (IXFS-16376) que en órdenes con split el reembolso
   * se dirige al **participante**, no a la transacción de pago. Enviar
   * `transactions` devuelve `split_validation_error`. Verificado contra sandbox:
   * la orden ORDTST01M4VK5KFTHHC0QZKGM7KS01PR quedó `partially_refunded`.
   */
  function fakeRefundOk(detail: string, refunds: unknown[]) {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    http.addRule({
      match: (o) => o.method === "POST" && String(o.path).includes("/refund"),
      response: {
        status: 201,
        headers: new Headers(),
        body: {
          id: "ORD123",
          status: "processed",
          status_detail: detail,
          transactions: { refunds },
        },
        rawText: "",
        problem: null,
      },
    });
    return http;
  }

  it("parcial a un participante manda splits[{receiver_id, amount}]", async () => {
    const http = fakeRefundOk("partially_refunded", [
      { id: "REF002", amount: "10.00", status: "processed" },
    ]);
    const result = await createMercadoPagoOrderRefund(http, {
      providerOrderId: "ORD123",
      idempotencyKey: "idem-parcial",
      splits: [{ receiverId: "748d158f-6dbd-444b-8f3d-b73204c972da", amount: money("ARS", 10_00n) }],
    });
    assert.equal(result.statusDetail, "partially_refunded");
    const body = http.recordedRequests[0]!.options.body as {
      splits: Array<{ receiver_id: string; amount?: string }>;
      transactions?: unknown;
    };
    assert.equal(body.splits[0]!.receiver_id, "748d158f-6dbd-444b-8f3d-b73204c972da");
    assert.equal(body.splits[0]!.amount, "10.00");
    assert.equal(body.transactions, undefined, "nunca se mezcla con transactions");
  });

  it("total a un participante manda el receiver_id sin amount", async () => {
    const http = fakeRefundOk("refunded", [{ id: "REF003", amount: "30.00", status: "processed" }]);
    await createMercadoPagoOrderRefund(http, {
      providerOrderId: "ORD123",
      idempotencyKey: "idem-total-1p",
      splits: [{ receiverId: "748d158f-6dbd-444b-8f3d-b73204c972da" }],
    });
    const body = http.recordedRequests[0]!.options.body as {
      splits: Array<{ receiver_id: string; amount?: string }>;
    };
    assert.equal(body.splits[0]!.receiver_id, "748d158f-6dbd-444b-8f3d-b73204c972da");
    assert.equal(body.splits[0]!.amount, undefined, "sin amount = pata completa");
  });

  it("combinado: parcial a uno y total a otro en el mismo request", async () => {
    const http = fakeRefundOk("partially_refunded", []);
    await createMercadoPagoOrderRefund(http, {
      providerOrderId: "ORD123",
      idempotencyKey: "idem-combinado",
      splits: [
        { receiverId: "3141372692", amount: money("ARS", 40_00n) },
        { receiverId: "748d158f-6dbd-444b-8f3d-b73204c972da" },
      ],
    });
    const body = http.recordedRequests[0]!.options.body as {
      splits: Array<{ receiver_id: string; amount?: string }>;
    };
    assert.equal(body.splits.length, 2);
    assert.equal(body.splits[0]!.amount, "40.00");
    assert.equal(body.splits[1]!.amount, undefined);
  });

  it("rechaza un monto que no sea positivo", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    await assert.rejects(
      () =>
        createMercadoPagoOrderRefund(http, {
          providerOrderId: "ORD123",
          idempotencyKey: "x",
          splits: [{ receiverId: "3141372692", amount: money("ARS", 0n) }],
        }),
      (err: unknown) =>
        err instanceof MercadoPagoRefundError && err.code === "INVALID_REFUND_AMOUNT",
    );
  });

  it("rechaza un receptor vacío", async () => {
    const http = new FakeMercadoPagoHttpClient(fakeMercadoPagoConfig());
    await assert.rejects(
      () =>
        createMercadoPagoOrderRefund(http, {
          providerOrderId: "ORD123",
          idempotencyKey: "x",
          splits: [{ receiverId: "   " }],
        }),
      (err: unknown) =>
        err instanceof MercadoPagoRefundError && err.code === "RECEIVER_ID_REQUIRED",
    );
  });
});
