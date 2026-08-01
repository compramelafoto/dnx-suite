import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AppendOnlyLedger } from "../../../ledger/index.js";
import { money } from "../../../money/index.js";
import type { PaymentProvider, ProviderRefundResult } from "../../../providers/types.js";
import { allocateRefundProportionally } from "./allocations.js";
import { assertRefundAuthorized, RefundAuthorizationError } from "./authorize.js";
import { createOrders1nRefundService } from "./create-refund.js";
import { applyOrdersRefundWebhookEffects } from "./observe-refund-effects.js";
import { reconcileMercadoPagoOrderRefunds } from "./reconcile-refunds.js";
import { getRefundableAmount, resolveRefundAmountMinor } from "./remaining.js";
import { InMemoryRefundStore } from "./store.js";
import type { RefundAllocationShare, RefundRequest } from "./types.js";

const OWNER_PARTNER3: RefundAllocationShare[] = [
  { recipientId: "owner", role: "OWNER", amountMinor: 34_000n },
  { recipientId: "p1", role: "PARTNER", amountMinor: 33_000n },
  { recipientId: "p2", role: "PARTNER", amountMinor: 33_000n },
];

function sharesN(nPartners: number, total: bigint): RefundAllocationShare[] {
  const parts: RefundAllocationShare[] = [
    { recipientId: "owner", role: "OWNER", amountMinor: 0n },
  ];
  const base = total / BigInt(nPartners + 1);
  let allocated = 0n;
  for (let i = 0; i < nPartners; i++) {
    parts.push({
      recipientId: `p${i + 1}`,
      role: "PARTNER",
      amountMinor: base,
    });
    allocated += base;
  }
  parts[0]!.amountMinor = total - allocated;
  return parts;
}

function fakeProvider(opts?: {
  failOnce?: boolean;
  refundId?: string;
}): Pick<PaymentProvider, "refund" | "getOrder"> {
  let calls = 0;
  return {
    async refund(input): Promise<ProviderRefundResult> {
      calls += 1;
      if (opts?.failOnce && calls === 1) {
        throw new Error("PROVIDER_TEMPORARY");
      }
      return {
        providerRefundId: opts?.refundId ?? `REF_${input.idempotencyKey}`,
        orderStatus: input.amount ? "processed" : "refunded",
        statusDetail: input.amount ? "partially_refunded" : "refunded",
      };
    },
    async getOrder(providerOrderId) {
      return {
        providerOrderId,
        status: "REFUNDED",
        statusDetail: "refunded",
        payments: [],
      };
    },
  };
}

function baseRequest(
  overrides: Partial<RefundRequest> = {},
): RefundRequest {
  return {
    paymentOrderId: "po_1",
    providerOrderId: "ORD_1",
    orderTotalMinor: 100_000n,
    currency: "ARS",
    environment: "sandbox",
    originalAllocations: OWNER_PARTNER3,
    providerTransactionId: "PAY_1",
    idempotencyKey: "idem-1",
    actor: {
      actorType: "admin",
      actorId: "admin-1",
      trustedService: true,
    },
    ...overrides,
  };
}

describe("allocateRefundProportionally", () => {
  it("sums exact for owner+3 partners", () => {
    const { allocations } = allocateRefundProportionally({
      refundAmountMinor: 20_000n,
      originalAllocations: OWNER_PARTNER3,
    });
    const sum = allocations.reduce((s, a) => s + a.amountMinor, 0n);
    assert.equal(sum, 20_000n);
  });

  it("supports owner + 10 partners with exact sum", () => {
    const original = sharesN(10, 100_000n);
    assert.equal(original.length, 11);
    const { allocations } = allocateRefundProportionally({
      refundAmountMinor: 37_777n,
      originalAllocations: original,
    });
    assert.equal(
      allocations.reduce((s, a) => s + a.amountMinor, 0n),
      37_777n,
    );
  });

  it("handles rounding remainder deterministically", () => {
    const a = allocateRefundProportionally({
      refundAmountMinor: 100n,
      originalAllocations: [
        { recipientId: "a", role: "OWNER", amountMinor: 333n },
        { recipientId: "b", role: "PARTNER", amountMinor: 333n },
        { recipientId: "c", role: "PARTNER", amountMinor: 334n },
      ],
    });
    assert.equal(
      a.allocations.reduce((s, x) => s + x.amountMinor, 0n),
      100n,
    );
  });
});

describe("remaining refundable", () => {
  it("rejects amount 0 and excess", () => {
    assert.throws(
      () =>
        resolveRefundAmountMinor({
          requestedAmountMinor: 0n,
          remainingMinor: 100n,
        }),
      /INVALID_REFUND_AMOUNT/,
    );
    assert.throws(
      () =>
        resolveRefundAmountMinor({
          requestedAmountMinor: 200n,
          remainingMinor: 100n,
        }),
      /REFUND_AMOUNT_EXCEEDS/,
    );
  });
});

describe("Orders 1:N refund service", () => {
  it("total refund exitoso", async () => {
    const store = new InMemoryRefundStore();
    const ledger = new AppendOnlyLedger();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
      ledger,
    });
    const result = await svc.createRefund(baseRequest({ amountMinor: undefined }));
    assert.equal(result.status, "PROCESSED");
    assert.equal(result.amountMinor, 100_000n);
    assert.equal(result.orderStatusAfter, "REFUNDED");
    assert.equal(result.reused, false);
    const bal = await svc.getRefundableAmount("po_1", 100_000n, "ARS");
    assert.equal(bal.remainingMinor, 0n);
  });

  it("parcial + múltiples + reject remaining 0", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
    });
    const r1 = await svc.createRefund(
      baseRequest({ amountMinor: 20_000n, idempotencyKey: "p1" }),
    );
    assert.equal(r1.amountMinor, 20_000n);
    const r2 = await svc.createRefund(
      baseRequest({ amountMinor: 30_000n, idempotencyKey: "p2" }),
    );
    assert.equal(r2.amountMinor, 30_000n);
    const r3 = await svc.createRefund(
      baseRequest({ amountMinor: undefined, idempotencyKey: "p3" }),
    );
    assert.equal(r3.amountMinor, 50_000n);
    assert.equal(r3.orderStatusAfter, "REFUNDED");
    await assert.rejects(
      () =>
        svc.createRefund(
          baseRequest({ amountMinor: 1n, idempotencyKey: "p4" }),
        ),
      /ORDER_FULLY_REFUNDED|REFUND_AMOUNT_EXCEEDS|INVALID/,
    );
  });

  it("idempotencia same key same payload", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
    });
    const a = await svc.createRefund(
      baseRequest({ amountMinor: 10_000n, idempotencyKey: "same" }),
    );
    const b = await svc.createRefund(
      baseRequest({ amountMinor: 10_000n, idempotencyKey: "same" }),
    );
    assert.equal(b.reused, true);
    assert.equal(a.refundId, b.refundId);
    const list = await svc.listRefundsForPayment("po_1");
    assert.equal(list.length, 1);
  });

  it("idempotencia same key different amount → conflict", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
    });
    await svc.createRefund(
      baseRequest({ amountMinor: 10_000n, idempotencyKey: "k" }),
    );
    await assert.rejects(
      () =>
        svc.createRefund(
          baseRequest({ amountMinor: 20_000n, idempotencyKey: "k" }),
        ),
      /IDEMPOTENCY/,
    );
  });

  it("provider failure marks FAILED", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider({ failOnce: true }),
    });
    await assert.rejects(
      () =>
        svc.createRefund(
          baseRequest({ amountMinor: 5_000n, idempotencyKey: "fail" }),
        ),
      /PROVIDER_TEMPORARY/,
    );
    const list = await svc.listRefundsForPayment("po_1");
    assert.equal(list[0]?.status, "FAILED");
    // remaining should ignore FAILED
    const bal = getRefundableAmount({
      paymentOrderId: "po_1",
      orderTotalMinor: 100_000n,
      currency: "ARS",
      refunds: list,
    });
    assert.equal(bal.remainingMinor, 100_000n);
  });

  it("ledger does not duplicate on idempotent retry", async () => {
    const store = new InMemoryRefundStore();
    const ledger = new AppendOnlyLedger();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
      ledger,
    });
    await svc.createRefund(
      baseRequest({ amountMinor: 10_000n, idempotencyKey: "led" }),
    );
    await svc.createRefund(
      baseRequest({ amountMinor: 10_000n, idempotencyKey: "led" }),
    );
    const refundEntries = ledger
      .list()
      .filter((e) => e.causeType === "RefundProcessed");
    assert.equal(refundEntries.length, 1);
  });

  it("unauthorized consumer rejected", async () => {
    assert.throws(
      () =>
        assertRefundAuthorized({
          paymentOrderId: "po_x",
          actor: {
            actorType: "organizer",
            actorId: "org-1",
            trustedService: false,
            authorizedPaymentOrderIds: ["po_other"],
          },
        }),
      RefundAuthorizationError,
    );
  });

  it("payment not refundable status", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
      resolveOrderStatus: async () => "FAILED",
    });
    await assert.rejects(
      () => svc.createRefund(baseRequest({ amountMinor: 1_000n })),
      /ORDER_NOT_REFUNDABLE/,
    );
  });

  it("webhook duplicate safe / reconcile", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
    });
    await svc.createRefund(
      baseRequest({ amountMinor: 100_000n, idempotencyKey: "full" }),
    );
    const fx1 = await applyOrdersRefundWebhookEffects({
      providerOrderId: "ORD_1",
      paymentOrderId: "po_1",
      providerStatus: "REFUNDED",
      orderTotalMinor: 100_000n,
      currency: "ARS",
      store,
    });
    const fx2 = await applyOrdersRefundWebhookEffects({
      providerOrderId: "ORD_1",
      paymentOrderId: "po_1",
      providerStatus: "REFUNDED",
      orderTotalMinor: 100_000n,
      currency: "ARS",
      store,
    });
    assert.equal(fx1.duplicateSafe, true);
    assert.equal(fx2.duplicateSafe, true);
    assert.equal(fx1.outcome, "acknowledged");

    const recon = await reconcileMercadoPagoOrderRefunds({
      providerOrderId: "ORD_1",
      paymentOrderId: "po_1",
      orderTotalMinor: 100_000n,
      currency: "ARS",
      environment: "sandbox",
      provider: fakeProvider(),
      store,
    });
    assert.equal(recon.fullyRefunded, true);
  });

  it("owner + 1 partner allocations sum exact", async () => {
    const store = new InMemoryRefundStore();
    const svc = createOrders1nRefundService({
      store,
      provider: fakeProvider(),
    });
    const result = await svc.createRefund(
      baseRequest({
        amountMinor: 50_000n,
        originalAllocations: [
          { recipientId: "owner", role: "OWNER", amountMinor: 70_000n },
          { recipientId: "p1", role: "PARTNER", amountMinor: 30_000n },
        ],
        idempotencyKey: "op1",
      }),
    );
    assert.equal(
      result.allocations.reduce((s, a) => s + a.amountMinor, 0n),
      50_000n,
    );
  });
});

describe("money contract", () => {
  it("uses minor units not floats", () => {
    const m = money("ARS", 100_000n);
    assert.equal(typeof m.amountMinor, "bigint");
  });
});
