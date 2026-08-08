import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  countsAsPaidRegistration,
  presentAdminRefundAmounts,
  presentAdminRefundBadge,
} from "./admin-refund-presentation";

describe("admin refund presentation", () => {
  it("badge REEMBOLSADA para total", () => {
    const b = presentAdminRefundBadge({
      registrationStatus: "REFUNDED",
      paymentStatus: "REFUNDED",
    });
    assert.equal(b.kind, "total");
    assert.equal(b.kind === "total" ? b.label : null, "REEMBOLSADA");
  });

  it("badge REEMBOLSO PARCIAL", () => {
    const b = presentAdminRefundBadge({
      registrationStatus: "CONFIRMED",
      paymentStatus: "PARTIALLY_REFUNDED",
    });
    assert.equal(b.kind, "partial");
    assert.equal(b.kind === "partial" ? b.label : null, "REEMBOLSO PARCIAL");
  });

  it("importes neto / devuelto", () => {
    const a = presentAdminRefundAmounts({
      totalAmount: 100_000,
      refundedAmountMinor: 25_000,
    });
    assert.equal(a.refundType, "partial");
    assert.notEqual(a.netLabel, a.paidLabel);
    assert.notEqual(a.refundedLabel, "—");
  });

  it("métricas excluyen reembolso total", () => {
    assert.equal(
      countsAsPaidRegistration({
        registrationStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
      }),
      false,
    );
    assert.equal(
      countsAsPaidRegistration({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
      }),
      true,
    );
    assert.equal(
      countsAsPaidRegistration({
        registrationStatus: "CONFIRMED",
        paymentStatus: "PARTIALLY_REFUNDED",
      }),
      true,
    );
  });
});
