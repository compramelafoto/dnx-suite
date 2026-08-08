import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPaymentRefundState } from "@repo/payments/mercado-pago";

describe("detectPaymentRefundState", () => {
  it("pago aprobado sin devolución", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1001,
        status: "approved",
        currency_id: "ARS",
        transaction_amount: 1500,
        transaction_amount_refunded: 0,
      },
    });
    assert.equal(d.status, "APPROVED");
    assert.equal(d.kind, "none");
    assert.equal(d.refundedAmountMinor, 0);
    assert.equal(d.amountMinor, 150_000);
  });

  it("reembolso total por status refunded", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1002,
        status: "refunded",
        currency_id: "ARS",
        transaction_amount: 1500,
        transaction_amount_refunded: 1500,
      },
    });
    assert.equal(d.status, "REFUNDED");
    assert.equal(d.kind, "total");
    assert.equal(d.refundedAmountMinor, 150_000);
    assert.equal(d.netAmountMinor, 0);
  });

  it("reembolso total con status approved + importe completo (caso real MP)", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1003,
        status: "approved",
        status_detail: "accredited",
        currency_id: "ARS",
        transaction_amount: 200,
        transaction_amount_refunded: 200,
      },
    });
    assert.equal(d.status, "REFUNDED");
    assert.equal(d.kind, "total");
  });

  it("reembolso parcial", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1004,
        status: "approved",
        status_detail: "partially_refunded",
        currency_id: "ARS",
        transaction_amount: 1000,
        transaction_amount_refunded: 250,
        refunds: [{ id: 55, amount: 250 }],
      },
    });
    assert.equal(d.status, "PARTIALLY_REFUNDED");
    assert.equal(d.kind, "partial");
    assert.equal(d.refundedAmountMinor, 25_000);
    assert.equal(d.netAmountMinor, 75_000);
    assert.deepEqual(d.providerRefundIds, ["55"]);
  });

  it("dos parciales que completan el total", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1005,
        status: "approved",
        currency_id: "ARS",
        transaction_amount: 1000,
        transaction_amount_refunded: 1000,
        refunds: [
          { id: 1, amount: 400 },
          { id: 2, amount: 600 },
        ],
      },
    });
    assert.equal(d.status, "REFUNDED");
    assert.equal(d.kind, "total");
    assert.equal(d.providerRefundIds.length, 2);
  });

  it("no supera el importe original", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1006,
        status: "refunded",
        currency_id: "ARS",
        transaction_amount: 100,
        transaction_amount_refunded: 150,
      },
    });
    assert.equal(d.refundedAmountMinor, 10_000);
    assert.equal(d.netAmountMinor, 0);
  });
});
