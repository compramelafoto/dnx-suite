/**
 * 10C.3.1 — Reconciliación Checkout Pro (refresh by external_reference + estados monotónicos).
 *
 * Precedencia (no inventar fuera de DNX):
 * APPROVED/PAID > PENDING/PROCESSING > CREATED
 * Terminal exitoso no regresa a PENDING/CREATED/PROCESSING por info stale.
 * Refund/cancel siguen reglas existentes (terminal → terminal permitido).
 */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { createInMemoryDnxPaymentsPersistence } from "../application/persistence/memory.js";
import {
  createClickatonCheckoutService,
  isTerminalNormalized,
  mapPaymentOrderStatusToNormalized,
} from "../application/services/clickaton-checkout/index.js";
import type { ClickatonCheckoutProviderBridge } from "../application/services/clickaton-checkout/types.js";

function hashPayload(parts: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
}

function baseCreate(sourceId: string, key: string, amountMinor = 2500) {
  return {
    sourceApp: "CLICKATON" as const,
    sourceType: "REGISTRATION" as const,
    sourceId,
    idempotencyKey: key,
    payloadHash: hashPayload({ sourceId, key }),
    amountMinor,
    currency: "ARS" as const,
    description: "recon-test",
    successUrl: "https://clickaton-staging.vercel.app/s",
    pendingUrl: "https://clickaton-staging.vercel.app/p",
    failureUrl: "https://clickaton-staging.vercel.app/f",
    isTestFixture: true,
  };
}

function approvedBridge(externalReference: string, amountMinor: number): ClickatonCheckoutProviderBridge {
  return {
    mode: "mercado_pago_test",
    providerName: "mercadopago_preferences_legacy",
    async createCheckout() {
      throw new Error("not_used");
    },
    async refreshCheckout(input) {
      // Simula preference id no numérico + payment APPROVED por external_reference.
      if (/^\d+$/.test(input.providerOrderId)) {
        return {
          status: "APPROVED",
          amountMinor,
          currency: "ARS",
          externalReference,
          liveMode: true,
          rawSanitized: { refresh_note: "payment_id" },
        };
      }
      if (input.externalReference === externalReference) {
        return {
          status: "APPROVED",
          amountMinor,
          currency: "ARS",
          externalReference,
          liveMode: true,
          rawSanitized: {
            refresh_note: "payment_resolved_by_external_reference",
            providerPaymentId: "170000000001",
          },
        };
      }
      return {
        status: "PENDING",
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
        externalReference: input.externalReference,
        liveMode: false,
        rawSanitized: { refresh_note: "preference_pending_no_payment_yet" },
      };
    },
    async fetchPaymentById(paymentId) {
      if (paymentId !== "170000000001") return null;
      return {
        status: "APPROVED",
        amountMinor,
        currency: "ARS",
        externalReference,
        liveMode: true,
        providerPaymentId: paymentId,
        rawSanitized: { id: paymentId },
      };
    },
  };
}

function pendingOnlyBridge(): ClickatonCheckoutProviderBridge {
  return {
    mode: "mercado_pago_test",
    providerName: "mercadopago_preferences_legacy",
    async createCheckout() {
      throw new Error("not_used");
    },
    async refreshCheckout(input) {
      return {
        status: "PENDING",
        amountMinor: input.expectedAmountMinor,
        currency: input.expectedCurrency,
        externalReference: input.externalReference,
        liveMode: false,
        rawSanitized: { refresh_note: "preference_pending_no_payment_yet" },
      };
    },
    async fetchPaymentById() {
      return null;
    },
  };
}

describe("10C.3.1 reconciliation + monotonic status", () => {
  it("documents terminal precedence helpers", () => {
    assert.equal(isTerminalNormalized("APPROVED"), true);
    assert.equal(isTerminalNormalized("PENDING"), false);
    assert.equal(isTerminalNormalized("PROCESSING"), false);
    assert.equal(isTerminalNormalized("CREATED"), false);
    assert.equal(mapPaymentOrderStatusToNormalized("PAID"), "APPROVED");
    assert.equal(mapPaymentOrderStatusToNormalized("AWAITING_PROVIDER"), "PENDING");
  });

  it("1) preference PENDING + payment APPROVED via refresh → PAID/APPROVED", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const created = await createClickatonCheckoutService(db).createOrder(
      baseCreate("reg_recon_1", "key_recon_1"),
    );
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const svc = createClickatonCheckoutService(db, {
      providerBridge: approvedBridge(created.order.externalReference, 2500),
    });
    const refreshed = await svc.refreshOrder(created.order.id);
    assert.ok(refreshed);
    assert.equal(refreshed!.status, "APPROVED");
    const durable = await db.paymentOrders.findById(created.order.id);
    assert.equal(durable?.status, "PAID");
  });

  it("2) APPROVED + stale PENDING refresh → no downgrade", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const created = await createClickatonCheckoutService(db).createOrder(
      baseCreate("reg_recon_2", "key_recon_2"),
    );
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const svcApproved = createClickatonCheckoutService(db, {
      providerBridge: approvedBridge(created.order.externalReference, 2500),
    });
    await svcApproved.refreshOrder(created.order.id);

    const svcStale = createClickatonCheckoutService(db, {
      providerBridge: pendingOnlyBridge(),
    });
    const after = await svcStale.refreshOrder(created.order.id);
    assert.ok(after);
    assert.equal(after!.status, "APPROVED");
    const durable = await db.paymentOrders.findById(created.order.id);
    assert.equal(durable?.status, "PAID");

    const audits = await db.audit.list({
      aggregateType: "payment_order",
      aggregateId: created.order.id,
    });
    assert.ok(
      audits.some(
        (a) =>
          a.action === "clickaton.checkout.refresh.ignored_non_terminal_after_terminal" ||
          a.action === "clickaton.checkout.event.ignored_non_terminal_after_terminal",
      ),
      `expected ignore audit, got: ${audits.map((a) => a.action).join(", ")}`,
    );
  });

  it("3) repeated APPROVED apply is idempotent", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc = createClickatonCheckoutService(db);
    const created = await svc.createOrder(baseCreate("reg_recon_3", "key_recon_3"));
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const event = {
      eventId: "evt_recon_3",
      orderId: created.order.id,
      status: "APPROVED" as const,
      amountMinor: 2500,
      currency: "ARS" as const,
      provider: "manual",
      externalReference: created.order.externalReference,
      sourceId: "reg_recon_3",
      receivedAt: new Date().toISOString(),
    };
    const a = await svc.applyNormalizedEvent(event);
    const b = await svc.applyNormalizedEvent(event);
    assert.equal(a.outcome, "applied");
    assert.equal(b.outcome, "duplicate");
    assert.equal(a.order?.status, "APPROVED");
    assert.equal(b.order?.status, "APPROVED");
  });

  it("4) payment not found keeps safe pending state", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const created = await createClickatonCheckoutService(db).createOrder(
      baseCreate("reg_recon_4", "key_recon_4"),
    );
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const svc = createClickatonCheckoutService(db, {
      providerBridge: pendingOnlyBridge(),
    });
    const refreshed = await svc.refreshOrder(created.order.id);
    assert.ok(refreshed);
    assert.equal(refreshed!.status, "PENDING");
    const durable = await db.paymentOrders.findById(created.order.id);
    assert.equal(durable?.status, "AWAITING_PROVIDER");
  });

  it("5) wrong external_reference / sourceId → fail safe conflict", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const svc = createClickatonCheckoutService(db);
    const created = await svc.createOrder(baseCreate("reg_recon_5", "key_recon_5"));
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const bad = await svc.applyNormalizedEvent({
      eventId: "evt_bad_ref",
      orderId: created.order.id,
      status: "APPROVED",
      amountMinor: 2500,
      currency: "ARS",
      provider: "manual",
      externalReference: "clickaton:registration:OTHER",
      sourceId: "OTHER",
      receivedAt: new Date().toISOString(),
    });
    assert.equal(bad.outcome, "conflict");
    assert.equal(bad.conflictCode, "PAYMENT_CONFLICT");
    const order = await svc.getOrder(created.order.id);
    assert.equal(order?.status, "PENDING");
  });

  it("6) concurrent webhook + refresh → final APPROVED", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const created = await createClickatonCheckoutService(db).createOrder(
      baseCreate("reg_recon_6", "key_recon_6"),
    );
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const svc = createClickatonCheckoutService(db, {
      providerBridge: approvedBridge(created.order.externalReference, 2500),
    });
    const event = {
      eventId: "evt_recon_6_wh",
      orderId: created.order.id,
      status: "APPROVED" as const,
      amountMinor: 2500,
      currency: "ARS" as const,
      provider: "manual",
      externalReference: created.order.externalReference,
      sourceId: "reg_recon_6",
      receivedAt: new Date().toISOString(),
      origin: "HTTP_WEBHOOK" as const,
    };

    const [wh, rf] = await Promise.all([
      svc.applyNormalizedEvent(event),
      svc.refreshOrder(created.order.id),
    ]);
    assert.ok(wh.outcome === "applied" || wh.outcome === "duplicate");
    assert.ok(rf);
    assert.equal(rf!.status, "APPROVED");
    const final = await svc.getOrder(created.order.id);
    assert.equal(final?.status, "APPROVED");
    const durable = await db.paymentOrders.findById(created.order.id);
    assert.equal(durable?.status, "PAID");
  });

  it("7) refresh after webhook → no regression", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const created = await createClickatonCheckoutService(db).createOrder(
      baseCreate("reg_recon_7", "key_recon_7"),
    );
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const svc = createClickatonCheckoutService(db, {
      providerBridge: approvedBridge(created.order.externalReference, 2500),
    });
    const wh = await svc.applyProviderPaymentNotification({
      providerPaymentId: "170000000001",
      eventId: "evt_recon_7_wh",
      liveModeReported: true,
      action: "payment.updated",
    });
    assert.equal(wh.outcome, "applied");
    assert.equal(wh.order?.status, "APPROVED");

    const stale = createClickatonCheckoutService(db, {
      providerBridge: pendingOnlyBridge(),
    });
    const after = await stale.refreshOrder(created.order.id);
    assert.equal(after?.status, "APPROVED");
  });

  it("8) webhook after refresh → no duplicate side-effect order status", async () => {
    const db = createInMemoryDnxPaymentsPersistence();
    const created = await createClickatonCheckoutService(db).createOrder(
      baseCreate("reg_recon_8", "key_recon_8"),
    );
    assert.equal(created.outcome, "created");
    if (created.outcome === "conflict") return;

    const svc = createClickatonCheckoutService(db, {
      providerBridge: approvedBridge(created.order.externalReference, 2500),
    });
    await svc.refreshOrder(created.order.id);

    const wh = await svc.applyProviderPaymentNotification({
      providerPaymentId: "170000000001",
      eventId: "evt_recon_8_wh",
      liveModeReported: true,
      action: "payment.updated",
    });
    assert.ok(wh.outcome === "applied" || wh.outcome === "duplicate");
    assert.equal(wh.order?.status, "APPROVED");
    let durable = await db.paymentOrders.findById(created.order.id);
    assert.equal(durable?.status, "PAID");

    // Segundo webhook mismo payment/event distinto: sigue APPROVED.
    const wh2 = await svc.applyProviderPaymentNotification({
      providerPaymentId: "170000000001",
      eventId: "evt_recon_8_wh_b",
      liveModeReported: true,
      action: "payment.updated",
    });
    assert.ok(wh2.outcome === "applied" || wh2.outcome === "duplicate");
    assert.equal(wh2.order?.status, "APPROVED");
    durable = await db.paymentOrders.findById(created.order.id);
    assert.equal(durable?.status, "PAID");
  });
});
