import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { createInMemoryDnxPaymentsPersistence } from "../application/persistence/memory.js";
import { createClickatonCheckoutService } from "../application/services/clickaton-checkout/index.js";

function hashPayload(parts: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

describe("clickaton checkout durable service", () => {
  it("creates and recovers order after new service instance", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc1 = createClickatonCheckoutService(db);
    const payloadHash = hashPayload({ a: 1 });
    const created = await svc1.createOrder({
      sourceApp: "CLICKATON",
      sourceType: "REGISTRATION",
      sourceId: "reg_1",
      idempotencyKey: "key_1",
      payloadHash,
      amountMinor: 1500,
      currency: "ARS",
      description: "test",
      successUrl: "http://localhost/s",
      pendingUrl: "http://localhost/p",
      failureUrl: "http://localhost/f",
      isTestFixture: true,
    });
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;
    assert.ok(created.order.checkoutUrl?.includes(created.order.id));

    const svc2 = createClickatonCheckoutService(db);
    const loaded = await svc2.getOrder(created.order.id);
    assert.ok(loaded);
    assert.equal(loaded!.id, created.order.id);
    assert.equal(loaded!.checkoutUrl, created.order.checkoutUrl);
    assert.equal(loaded!.amountMinor, 1500);
  });

  it("reuses same idempotency key and conflicts on hash change", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc = createClickatonCheckoutService(db);
    const base = {
      sourceApp: "CLICKATON" as const,
      sourceType: "REGISTRATION" as const,
      sourceId: "reg_2",
      idempotencyKey: "key_2",
      payloadHash: hashPayload({ n: 1 }),
      amountMinor: 2000,
      currency: "ARS" as const,
      description: "test",
      successUrl: "http://localhost/s",
      pendingUrl: "http://localhost/p",
      failureUrl: "http://localhost/f",
      isTestFixture: true,
    };
    const first = await svc.createOrder(base);
    assert.equal(first.outcome, "created");
    const second = await svc.createOrder(base);
    assert.equal(second.outcome, "reused");
    if (first.outcome === "conflict" || second.outcome === "conflict") return;
    assert.equal(first.order.id, second.order.id);

    const conflict = await svc.createOrder({
      ...base,
      payloadHash: hashPayload({ n: 2 }),
      amountMinor: 3000,
    });
    assert.equal(conflict.outcome, "conflict");
  });

  it("applies normalized events idempotently and detects amount mismatch", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc = createClickatonCheckoutService(db);
    const created = await svc.createOrder({
      sourceApp: "CLICKATON",
      sourceType: "REGISTRATION",
      sourceId: "reg_3",
      idempotencyKey: "key_3",
      payloadHash: hashPayload({ x: 1 }),
      amountMinor: 1000,
      currency: "ARS",
      description: "test",
      successUrl: "http://localhost/s",
      pendingUrl: "http://localhost/p",
      failureUrl: "http://localhost/f",
      isTestFixture: true,
    });
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const event = {
      eventId: "evt_1",
      orderId: created.order.id,
      status: "APPROVED" as const,
      amountMinor: 1000,
      currency: "ARS" as const,
      provider: "manual",
      externalReference: created.order.externalReference,
      sourceId: "reg_3",
      receivedAt: new Date().toISOString(),
    };
    const applied = await svc.applyNormalizedEvent(event);
    assert.equal(applied.outcome, "applied");
    assert.equal(applied.order?.status, "APPROVED");

    const dup = await svc.applyNormalizedEvent(event);
    assert.equal(dup.outcome, "duplicate");

    const mismatch = await svc.applyNormalizedEvent({
      ...event,
      eventId: "evt_2",
      amountMinor: 1,
    });
    assert.equal(mismatch.outcome, "conflict");
    assert.equal(mismatch.conflictCode, "PAYMENT_AMOUNT_MISMATCH");
  });

  it("reconciles approved vs pending registration", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc = createClickatonCheckoutService(db);
    const created = await svc.createOrder({
      sourceApp: "CLICKATON",
      sourceType: "REGISTRATION",
      sourceId: "reg_4",
      idempotencyKey: "key_4",
      payloadHash: hashPayload({ y: 1 }),
      amountMinor: 500,
      currency: "ARS",
      description: "test",
      successUrl: "http://localhost/s",
      pendingUrl: "http://localhost/p",
      failureUrl: "http://localhost/f",
      isTestFixture: true,
    });
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    await svc.applyNormalizedEvent({
      eventId: "evt_ok",
      orderId: created.order.id,
      status: "APPROVED",
      amountMinor: 500,
      currency: "ARS",
      provider: "manual",
      externalReference: created.order.externalReference,
      sourceId: "reg_4",
      receivedAt: new Date().toISOString(),
    });

    const review = await svc.reconcile({
      registrationId: "reg_4",
      registrationStatus: "PENDING_PAYMENT",
      registrationPaymentStatus: "PENDING",
      paymentOrderId: created.order.id,
      registrationAmountMinor: 500,
      registrationCurrency: "ARS",
      capacityHoldActive: true,
    });
    assert.equal(review.status, "MANUAL_REVIEW");
    assert.ok(review.findings.includes("approved_order_pending_registration"));

    const ok = await svc.reconcile({
      registrationId: "reg_4",
      registrationStatus: "CONFIRMED",
      registrationPaymentStatus: "APPROVED",
      paymentOrderId: created.order.id,
      registrationAmountMinor: 500,
      registrationCurrency: "ARS",
      capacityHoldActive: false,
    });
    assert.equal(ok.status, "CONSISTENT");
  });

  it("parallel create with same key yields one order", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc = createClickatonCheckoutService(db);
    const input = {
      sourceApp: "CLICKATON" as const,
      sourceType: "REGISTRATION" as const,
      sourceId: "reg_5",
      idempotencyKey: "key_parallel",
      payloadHash: hashPayload({ p: 1 }),
      amountMinor: 900,
      currency: "ARS" as const,
      description: "test",
      successUrl: "http://localhost/s",
      pendingUrl: "http://localhost/p",
      failureUrl: "http://localhost/f",
      isTestFixture: true,
    };
    const [a, b] = await Promise.all([svc.createOrder(input), svc.createOrder(input)]);
    assert.notEqual(a.outcome, "conflict");
    assert.notEqual(b.outcome, "conflict");
    if (a.outcome === "conflict" || b.outcome === "conflict") return;
    assert.equal(a.order.id, b.order.id);
  });
});
