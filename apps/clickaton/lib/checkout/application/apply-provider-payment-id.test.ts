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
    status: "CONFIRMED",
    paymentStatus: "APPROVED",
    holdExpiresAt: null,
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
    providerPaymentId: null,
    ...overrides,
  };
}

function makePort(reg: ClickatonRegistrationRecord): CheckoutRegistrationPort & {
  syncs: string[];
} {
  let current = structuredClone(reg);
  const syncs: string[] = [];
  return {
    syncs,
    getRegistration: async () => structuredClone(current),
    getEditionPrefix: async () => "AR",
    attachPaymentRefs: async () => current,
    confirmPaid: async (input) => {
      current = {
        ...current,
        status: "CONFIRMED",
        paymentStatus: "APPROVED",
        cancelledAt: null,
        confirmedAt: new Date(),
        providerPaymentId:
          current.providerPaymentId ??
          (input.providerPaymentId && /^\d+$/.test(input.providerPaymentId)
            ? input.providerPaymentId
            : current.providerPaymentId),
      };
      return structuredClone(current);
    },
    markPaymentStatus: async (input) => {
      if (input.registrationStatus) current.status = input.registrationStatus;
      current.paymentStatus = input.paymentStatus;
      return structuredClone(current);
    },
    syncProviderPaymentId: async (input) => {
      syncs.push(input.providerPaymentId);
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
    getHoldSnapshot: async () => ({ capacityHoldActive: true, stockHoldsActive: 0 }),
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
    providerPaymentId: "171556178494",
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

describe("providerPaymentId sync on APPROVED", () => {
  it("null local → backfill (applied)", async () => {
    const port = makePort(baseReg({ providerPaymentId: null }));
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_backfill",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
      providerPaymentId: "171556178494",
    });
    assert.equal(result.applied, true);
    assert.equal(result.duplicate, false);
    assert.deepEqual(port.syncs, ["171556178494"]);
    const reg = await port.getRegistration("reg_1");
    assert.equal(reg?.providerPaymentId, "171556178494");
  });

  it("mismo ID → noop duplicate", async () => {
    const port = makePort(baseReg({ providerPaymentId: "171556178494" }));
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_same",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
      providerPaymentId: "171556178494",
    });
    assert.equal(result.applied, false);
    assert.equal(result.duplicate, true);
  });

  it("ID distinto → MANUAL_REVIEW", async () => {
    const port = makePort(baseReg({ providerPaymentId: "111" }));
    const uc = createApplyPaymentEventUseCase({
      payments: makePayments("APPROVED"),
      registrationPort: port,
    });
    const result = await uc.execute({
      eventId: "evt_conflict",
      orderId: "ord_1",
      status: "APPROVED",
      amountMinor: 2_500_000,
      currency: "ARS",
      provider: "mp",
      externalReference: "clickaton:reg_1",
      sourceId: "reg_1",
      receivedAt: new Date(),
      providerPaymentId: "222",
    });
    assert.equal(result.conflict, true);
    assert.equal(result.paymentStatus, "MANUAL_REVIEW");
  });
});
