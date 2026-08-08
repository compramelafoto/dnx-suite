import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { detectPaymentRefundState } from "./detect-payment-refund-state.js";
import { canApplyNormalizedStatusTransition } from "../../../application/services/clickaton-checkout/map-status.js";

describe("detectPaymentRefundState + transitions", () => {
  it("approved sin refund", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 1,
        status: "approved",
        currency_id: "ARS",
        transaction_amount: 10,
        transaction_amount_refunded: 0,
      },
    });
    assert.equal(d.status, "APPROVED");
    assert.equal(d.kind, "none");
  });

  it("approved + refunded amount = total → REFUNDED", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 2,
        status: "approved",
        currency_id: "ARS",
        transaction_amount: 10,
        transaction_amount_refunded: 10,
      },
    });
    assert.equal(d.status, "REFUNDED");
  });

  it("parcial", () => {
    const d = detectPaymentRefundState({
      raw: {
        id: 3,
        status: "approved",
        currency_id: "ARS",
        transaction_amount: 10,
        transaction_amount_refunded: 3,
      },
    });
    assert.equal(d.status, "PARTIALLY_REFUNDED");
    assert.equal(d.refundedAmountMinor, 300);
  });

  it("bloquea regresión REFUNDED → APPROVED", () => {
    assert.equal(canApplyNormalizedStatusTransition("REFUNDED", "APPROVED"), false);
    assert.equal(canApplyNormalizedStatusTransition("APPROVED", "REFUNDED"), true);
    assert.equal(
      canApplyNormalizedStatusTransition("PARTIALLY_REFUNDED", "REFUNDED"),
      true,
    );
    assert.equal(
      canApplyNormalizedStatusTransition("PARTIALLY_REFUNDED", "APPROVED"),
      false,
    );
  });
});
