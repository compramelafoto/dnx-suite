import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyLateApprovalRecovery,
  expirationCronMayTouch,
  isAutoExpirationTerminal,
} from "./payment-precedence";

describe("payment precedence Imp-03", () => {
  it("EXPIRED automático + APPROVED → revive", () => {
    assert.equal(
      classifyLateApprovalRecovery({
        registrationStatus: "CANCELLED",
        paymentStatus: "EXPIRED",
        orderStatus: "APPROVED",
        capacityHoldActive: false,
        holdExpired: true,
      }),
      "revive_auto_expiration",
    );
  });

  it("PENDING_PAYMENT con hold vencido + APPROVED → revive", () => {
    assert.equal(
      classifyLateApprovalRecovery({
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
        orderStatus: "APPROVED",
        capacityHoldActive: false,
        holdExpired: true,
      }),
      "revive_auto_expiration",
    );
  });

  it("REFUNDED + APPROVED tardío → bloqueado", () => {
    assert.equal(
      classifyLateApprovalRecovery({
        registrationStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
        orderStatus: "APPROVED",
        capacityHoldActive: false,
        holdExpired: false,
      }),
      "blocked_refunded",
    );
  });

  it("CANCELLED manual (payment CANCELLED) + APPROVED → manual review path", () => {
    assert.equal(
      classifyLateApprovalRecovery({
        registrationStatus: "CANCELLED",
        paymentStatus: "CANCELLED",
        orderStatus: "APPROVED",
        capacityHoldActive: false,
        holdExpired: false,
      }),
      "blocked_manual_cancel",
    );
  });

  it("CONFIRMED+APPROVED + APPROVED → none (idempotente)", () => {
    assert.equal(
      classifyLateApprovalRecovery({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
        orderStatus: "APPROVED",
        capacityHoldActive: false,
        holdExpired: false,
      }),
      "none",
    );
  });

  it("cron no toca APPROVED/CONFIRMED/REFUNDED", () => {
    assert.equal(
      expirationCronMayTouch({
        registrationStatus: "CONFIRMED",
        paymentStatus: "APPROVED",
      }),
      false,
    );
    assert.equal(
      expirationCronMayTouch({
        registrationStatus: "REFUNDED",
        paymentStatus: "REFUNDED",
      }),
      false,
    );
    assert.equal(
      expirationCronMayTouch({
        registrationStatus: "PENDING_PAYMENT",
        paymentStatus: "PENDING",
      }),
      true,
    );
  });

  it("isAutoExpirationTerminal", () => {
    assert.equal(
      isAutoExpirationTerminal({
        registrationStatus: "CANCELLED",
        paymentStatus: "EXPIRED",
      }),
      true,
    );
    assert.equal(
      isAutoExpirationTerminal({
        registrationStatus: "CANCELLED",
        paymentStatus: "CANCELLED",
      }),
      false,
    );
  });
});
