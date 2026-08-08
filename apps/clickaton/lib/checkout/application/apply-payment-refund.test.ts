import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapDnxStatusToClickatonEffect, mapProviderStatusToDnx } from "../domain/mapping";
import { createApplyPaymentEventUseCase } from "./apply-payment-event";
import type { CheckoutRegistrationPort } from "../domain/checkout-registration-port";
import type { DnxPaymentsClient } from "../infrastructure/dnx-payments-client";
import type { ClickatonRegistrationRecord } from "@/lib/registration/domain/types";
import type { PaymentOrder } from "../domain/types";

function baseReg(
  overrides: Partial<ClickatonRegistrationRecord> = {},
): ClickatonRegistrationRecord {
  return {
    id: "reg_1",
    editionId: "ed_1",
    userId: 1,
    ticketTypeId: "tt_1",
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    participant: {
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      country: "AR",
    },
    money: {
      currency: "ARS",
      subtotalAmount: 100_000,
      discountAmount: 0,
      totalAmount: 100_000,
    },
    items: [],
    paymentOrderId: "ord_1",
    ...overrides,
  };
}

function makePort(reg: ClickatonRegistrationRecord): CheckoutRegistrationPort & {
  marks: unknown[];
} {
  const marks: unknown[] = [];
  let current = structuredClone(reg);
  return {
    marks,
    getRegistration: async () => structuredClone(current),
    getEditionPrefix: async () => "AR",
    attachPaymentRefs: async () => current,
    confirmPaid: async () => {
      throw new Error("should_not_confirm_on_refund");
    },
    markPaymentStatus: async (input) => {
      marks.push(input);
      if (input.registrationStatus) current.status = input.registrationStatus;
      current.paymentStatus = input.paymentStatus;
      if (typeof input.refundedAmountMinor === "number") {
        current.refundedAmountMinor = input.refundedAmountMinor;
      }
      if (input.providerPaymentId) current.providerPaymentId = input.providerPaymentId;
      return structuredClone(current);
    },
    releaseForPaymentTerminal: async () => current,
    expireRegistration: async () => ({ outcome: "ok" }),
    getHoldSnapshot: async () => ({ capacityHoldActive: false, stockHoldsActive: 0 }),
  };
}

function makePayments(orderStatus: PaymentOrder["status"]): DnxPaymentsClient {
  const order: PaymentOrder = {
    id: "ord_1",
    provider: "mercadopago_preferences_legacy",
    status: orderStatus,
    amountMinor: 100_000,
    currency: "ARS",
    externalReference: "clickaton:reg_1",
    checkoutUrl: null,
    sourceApp: "CLICKATON",
    sourceType: "REGISTRATION",
    sourceId: "reg_1",
    idempotencyKey: "k",
    payloadHash: "h",
    attempt: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    approvedAt: new Date(),
    lastEventId: null,
    lastEventAt: null,
  };
  return {
    createOrder: async () => ({ outcome: "created", order }),
    getOrder: async () => order,
    refreshOrder: async () => order,
    verifyWebhook: () => ({ ok: false, code: "x" }),
    applyVerifiedEvent: async () => order,
  };
}

describe("apply payment refund effects", () => {
  it("mapea PARTIALLY_REFUNDED sin cancelar inscripción", () => {
    assert.equal(mapProviderStatusToDnx("PARTIALLY_REFUNDED"), "PARTIALLY_REFUNDED");
    const effect = mapDnxStatusToClickatonEffect("PARTIALLY_REFUNDED");
    assert.equal(effect.registrationStatus, "CONFIRMED");
    assert.equal(effect.paymentStatus, "PARTIALLY_REFUNDED");
  });

  it("reembolso total marca REFUNDED", async () => {
    const port = makePort(baseReg());
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("REFUNDED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_refund_1",
      orderId: "ord_1",
      status: "REFUNDED",
      amountMinor: 100_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
      refundedAmountMinor: 100_000,
      providerPaymentId: "999",
      providerRefundIds: ["r1"],
    });
    assert.equal(result.applied, true);
    assert.equal(result.registrationStatus, "REFUNDED");
    assert.equal(result.paymentStatus, "REFUNDED");
    assert.equal((port.marks[0] as { refundedAmountMinor?: number }).refundedAmountMinor, 100_000);
  });

  it("reembolso parcial", async () => {
    const port = makePort(baseReg());
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("PARTIALLY_REFUNDED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_refund_p",
      orderId: "ord_1",
      status: "PARTIALLY_REFUNDED",
      amountMinor: 100_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
      refundedAmountMinor: 40_000,
      providerPaymentId: "999",
      providerRefundIds: ["r1"],
    });
    assert.equal(result.applied, true);
    assert.equal(result.registrationStatus, "CONFIRMED");
    assert.equal(result.paymentStatus, "PARTIALLY_REFUNDED");
  });

  it("webhook duplicado no vuelve a mutar", async () => {
    const port = makePort(
      baseReg({
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        refundedAmountMinor: 100_000,
      }),
    );
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("REFUNDED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_dup",
      orderId: "ord_1",
      status: "REFUNDED",
      amountMinor: 100_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
      refundedAmountMinor: 100_000,
    });
    assert.equal(result.duplicate, true);
    assert.equal(port.marks.length, 0);
  });

  it("inscripción inexistente", async () => {
    const port = makePort(baseReg());
    port.getRegistration = async () => null;
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("REFUNDED"),
      registrationPort: port,
    });
    await assert.rejects(
      () =>
        uc.execute({
          eventId: "evt_missing",
          orderId: "ord_1",
          status: "REFUNDED",
          amountMinor: 100_000,
          currency: "ARS",
          provider: "mp",
          externalReference: "x",
          sourceId: "missing",
          receivedAt: new Date(),
        }),
      /no encontrada/i,
    );
  });
});
