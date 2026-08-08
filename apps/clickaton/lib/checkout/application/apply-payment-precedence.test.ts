import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
    status: "CANCELLED",
    paymentStatus: "EXPIRED",
    holdExpiresAt: new Date(Date.now() - 60_000),
    participant: {
      firstName: "A",
      lastName: "B",
      email: "a@test.com",
      country: "AR",
    },
    money: {
      currency: "ARS",
      subtotalAmount: 2_500_000,
      discountAmount: 0,
      totalAmount: 2_500_000,
    },
    items: [],
    paymentOrderId: "ord_1",
    ...overrides,
  };
}

function makePort(reg: ClickatonRegistrationRecord): CheckoutRegistrationPort & {
  confirms: number;
} {
  let current = structuredClone(reg);
  let confirms = 0;
  return {
    get confirms() {
      return confirms;
    },
    getRegistration: async () => structuredClone(current),
    getEditionPrefix: async () => "AR",
    attachPaymentRefs: async () => current,
    confirmPaid: async () => {
      confirms += 1;
      current = {
        ...current,
        status: "CONFIRMED",
        paymentStatus: "APPROVED",
        cancelledAt: null,
        confirmedAt: new Date(),
      };
      return structuredClone(current);
    },
    markPaymentStatus: async (input) => {
      if (input.registrationStatus) current.status = input.registrationStatus;
      current.paymentStatus = input.paymentStatus;
      return structuredClone(current);
    },
    syncProviderPaymentId: async (input) => {
      const local = current.providerPaymentId?.trim() ?? "";
      const remote = input.providerPaymentId.trim();
      if (!local) {
        current.providerPaymentId = remote;
        return {
          outcome: "persisted" as const,
          providerPaymentId: remote,
          paymentStatus: current.paymentStatus,
        };
      }
      if (local === remote) {
        return {
          outcome: "noop" as const,
          providerPaymentId: local,
          paymentStatus: current.paymentStatus,
        };
      }
      current.paymentStatus = "MANUAL_REVIEW";
      return {
        outcome: "manual_review" as const,
        providerPaymentId: local,
        paymentStatus: "MANUAL_REVIEW" as const,
      };
    },
    releaseForPaymentTerminal: async () => current,
    expireRegistration: async () => ({ outcome: "ok" }),
    getHoldSnapshot: async () => ({ capacityHoldActive: false, stockHoldsActive: 0 }),
  };
}

function makePayments(status: PaymentOrder["status"]): DnxPaymentsClient {
  const order: PaymentOrder = {
    id: "ord_1",
    provider: "mercadopago_preferences_legacy",
    status,
    amountMinor: 2_500_000,
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

describe("apply-payment-event precedence Imp-03", () => {
  it("EXPIRED automático + APPROVED → CONFIRMED", async () => {
    const port = makePort(baseReg());
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_late_ok",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
    });
    assert.equal(result.applied, true);
    assert.equal(result.registrationStatus, "CONFIRMED");
    assert.equal(result.paymentStatus, "APPROVED");
    assert.equal(port.confirms, 1);
  });

  it("REFUNDED + APPROVED tardío → no confirma", async () => {
    const port = makePort(
      baseReg({
        status: "REFUNDED",
        paymentStatus: "REFUNDED",
        refundedAmountMinor: 2_500_000,
      }),
    );
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_refund_blocks",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
    });
    assert.equal(result.applied, false);
    assert.equal(result.conflict, true);
    assert.equal(port.confirms, 0);
  });

  it("CANCELLED manual + APPROVED → MANUAL_REVIEW", async () => {
    const port = makePort(
      baseReg({
        status: "CANCELLED",
        paymentStatus: "CANCELLED",
      }),
    );
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_manual",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
    });
    assert.equal(result.conflict, true);
    assert.equal(result.paymentStatus, "MANUAL_REVIEW");
    assert.equal(port.confirms, 0);
  });

  it("APPROVED duplicado → duplicate", async () => {
    const port = makePort(
      baseReg({
        status: "CONFIRMED",
        paymentStatus: "APPROVED",
        holdExpiresAt: null,
      }),
    );
    port.getHoldSnapshot = async () => ({
      capacityHoldActive: true,
      stockHoldsActive: 0,
    });
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_dup",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
    });
    assert.equal(result.duplicate, true);
    assert.equal(port.confirms, 0);
  });
});
